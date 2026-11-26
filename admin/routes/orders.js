/**
 * Orders.
 *
 * Totals are always recomputed from the line items and the payments table, so
 * the order row can never drift. Marking an order delivered/completed writes
 * negative rows into the stock ledger (and reverting removes them), which keeps
 * inventory correct without a stored counter.
 */

import express from 'express';
import { ulid } from '../../shared/ids.js';
import { recordDelete, recordInsert, recordUpdate } from '../sync/outbox.js';
import { insertInventoryLog } from './products.js';

const ORDER_TYPES = new Set(['walkin', 'delivery']);
const FULFILLMENT = new Set(['pending', 'out_for_delivery', 'delivered', 'completed', 'cancelled']);
const SOLD_STATUSES = new Set(['delivered', 'completed']);

const ITEM_COUNT =
  '(SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id AND i.deleted_at IS NULL)';
const UNIT_COUNT =
  '(SELECT COALESCE(SUM(i.qty), 0) FROM order_items i WHERE i.order_id = o.id AND i.deleted_at IS NULL)';

export function getOrder(db, id) {
  return db.prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL').get(id);
}

export function getItems(db, orderId) {
  return db
    .prepare('SELECT * FROM order_items WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at')
    .all(orderId);
}

export function getPayments(db, orderId) {
  return db
    .prepare('SELECT * FROM payments WHERE order_id = ? AND deleted_at IS NULL ORDER BY paid_at')
    .all(orderId);
}

/** Recompute subtotal / discount / total / paid / payment status from items + payments. */
export function recalcOrder(db, orderId) {
  const order = getOrder(db, orderId);
  if (!order) return null;

  const items = getItems(db, orderId);
  // Reads the price each line was SOLD at (stored on the line). Never re-price
  // an existing order from the products table - that would rewrite history.
  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total_cents ?? 0), 0);

  // The discount comes off the goods only and can never exceed them, so a
  // total can never go negative. Store the clamped value back.
  const discount = Math.max(0, Math.min(Math.round(Number(order.discount_cents ?? 0)), subtotal));
  const deliveryFee = Number(order.delivery_fee_cents ?? 0);
  const total = subtotal - discount + deliveryFee;

  const payments = getPayments(db, orderId);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount_cents ?? 0), 0);

  const paymentStatus = paid <= 0 ? 'unpaid' : paid < total ? 'partial' : 'paid';

  db.prepare(
    'UPDATE orders SET subtotal_cents = ?, discount_cents = ?, total_cents = ?, amount_paid_cents = ?, ' +
      'payment_status = ?, updated_at = ? WHERE id = ?',
  ).run(subtotal, discount, total, paid, paymentStatus, Date.now(), orderId);

  return getOrder(db, orderId);
}

/** Normalise the discount fields coming from the client. */
function readDiscountFields(source) {
  const percent = Math.round(Number(source.discount_percent) || 0);
  return {
    discount_cents: Math.max(0, Math.round(Number(source.discount_cents) || 0)),
    discount_percent: Math.max(0, Math.min(100, percent)),
    discount_reason: source.discount_reason
      ? String(source.discount_reason).trim().slice(0, 60) || null
      : null,
  };
}

/** Put stock back by soft-deleting an order's sale ledger rows. */
export function removeSaleStock(db, orderId) {
  const existing = db
    .prepare("SELECT * FROM inventory_logs WHERE reference = ? AND reason = 'sale' AND deleted_at IS NULL")
    .all(orderId);

  if (!existing.length) return 0;

  const now = Date.now();
  for (const log of existing) {
    db.prepare('UPDATE inventory_logs SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      log.id,
    );
    recordDelete('inventory_logs', { ...log, deleted_at: now, updated_at: now });
  }
  return existing.length;
}

/** Mirror the sale into the stock ledger when an order is delivered/completed. */
export function syncSaleStock(db, order) {
  const shouldDeduct = SOLD_STATUSES.has(order.fulfillment_status);
  const active = db
    .prepare("SELECT COUNT(*) AS n FROM inventory_logs WHERE reference = ? AND reason = 'sale' AND deleted_at IS NULL")
    .get(order.id);

  if (shouldDeduct && !Number(active?.n ?? 0)) {
    for (const item of getItems(db, order.id)) {
      if (!item.product_id) continue;

      // Refills and anything else not stock-tracked never touch the ledger.
      const product = db.prepare('SELECT track_stock FROM products WHERE id = ?').get(item.product_id);
      if (!product || Number(product.track_stock) !== 1) continue;

      insertInventoryLog(db, {
        productId: item.product_id,
        changeQty: -Math.abs(Number(item.qty) || 0),
        reason: 'sale',
        reference: order.id,
        note: `Order ${order.id.slice(-6).toUpperCase()}`,
      });
    }
    return;
  }

  if (!shouldDeduct) removeSaleStock(db, order.id);
}

function resolveCustomer(db, body) {
  const phone = body.customer_phone ? String(body.customer_phone).trim() : null;
  const name = body.customer_name ? String(body.customer_name).trim() : null;

  if (body.customer_id) return String(body.customer_id);

  if (phone) {
    const match = db
      .prepare('SELECT id FROM customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1')
      .get(phone);
    if (match) return match.id;
  }

  if (name && body.save_customer) {
    const now = Date.now();
    const id = ulid();
    db.prepare(
      'INSERT INTO customers (id, name, phone, address, facebook, notes, created_at, updated_at, deleted_at) ' +
        'VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL)',
    ).run(id, name, phone, body.address ? String(body.address).trim() : null, now, now);
    recordInsert('customers', db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
    return id;
  }

  return null;
}

/**
 * Snapshot an order's lines.
 *
 * IMPORTANT - order lines are financial history. The unit price is COPIED onto
 * the line and never looked up again, so changing a product's price can never
 * alter what a customer was already charged. `recalcOrder` reads these stored
 * values too, so nothing downstream re-derives an old total from the catalogue.
 *
 * `soldPrices` (optional Map of product_id -> unit_price_cents) lets a caller
 * preserve the price a line was originally sold at - used when an order's items
 * are replaced. Anything missing from it is priced at today's catalogue.
 */
function buildItems(db, orderId, rawItems, soldPrices = null) {
  const now = Date.now();
  const created = [];
  for (const raw of rawItems) {
    const productId = raw.product_id ? String(raw.product_id) : null;
    const qty = Math.round(Number(raw.qty) || 0);
    if (!productId || qty <= 0) continue;

    const product = db
      .prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL')
      .get(productId);
    if (!product) continue;

    const unitPrice = soldPrices?.has(productId)
      ? soldPrices.get(productId)
      : Number(product.price_cents ?? 0);
    const item = {
      id: ulid(),
      order_id: orderId,
      product_id: productId,
      product_name: product.name,
      unit: product.unit,
      qty,
      unit_price_cents: unitPrice,
      line_total_cents: unitPrice * qty,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    db.prepare(
      'INSERT INTO order_items (id, order_id, product_id, product_name, unit, qty, unit_price_cents, line_total_cents, created_at, updated_at, deleted_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    ).run(
      item.id,
      item.order_id,
      item.product_id,
      item.product_name,
      item.unit,
      item.qty,
      item.unit_price_cents,
      item.line_total_cents,
      item.created_at,
      item.updated_at,
    );
    recordInsert('order_items', item);
    created.push(item);
  }
  return created;
}

export function fullOrder(db, id) {
  const order = getOrder(db, id);
  if (!order) return null;
  return { order, items: getItems(db, id), payments: getPayments(db, id) };
}

export function mountOrderRoutes(api, db) {
  api.get('/orders', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const clauses = ['o.deleted_at IS NULL'];
    const params = [];

    if (req.query.status) {
      clauses.push('o.fulfillment_status = ?');
      params.push(String(req.query.status));
    } else if (req.query.open === '1') {
      clauses.push("o.fulfillment_status NOT IN ('delivered', 'completed', 'cancelled')");
    }
    if (req.query.payment === 'due') {
      clauses.push("o.payment_status IN ('unpaid', 'partial')");
    } else if (req.query.payment) {
      clauses.push('o.payment_status = ?');
      params.push(String(req.query.payment));
    }
    if (req.query.type) {
      clauses.push('o.order_type = ?');
      params.push(String(req.query.type));
    }
    if (req.query.search) {
      clauses.push('(o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
      const like = `%${req.query.search}%`;
      params.push(like, like);
    }

    const rows = db
      .prepare(
        `SELECT o.*, ${ITEM_COUNT} AS items_count, ${UNIT_COUNT} AS units
         FROM orders o WHERE ${clauses.join(' AND ')}
         ORDER BY o.placed_at DESC LIMIT ${limit}`,
      )
      .all(...params);

    const totals = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN payment_status IN ('unpaid','partial') THEN total_cents - amount_paid_cents ELSE 0 END), 0) AS outstanding_cents,
           COALESCE(SUM(amount_paid_cents), 0) AS collected_cents,
           COUNT(*) AS count
         FROM orders WHERE deleted_at IS NULL`,
      )
      .get();

    res.json({ orders: rows, totals });
  });

  api.get('/orders/:id', (req, res) => {
    const data = fullOrder(db, req.params.id);
    if (!data) return res.status(404).json({ error: 'Order not found.' });
    return res.json(data);
  });

  api.post('/orders', (req, res) => {
    const body = req.body ?? {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) return res.status(400).json({ error: 'Add at least one item.' });

    // Selling more than you have is allowed, but never by accident: the form
    // confirms first and re-sends with allow_over_stock.
    const shortfalls = stockShortfalls(db, rawItems);
    if (shortfalls.length && body.allow_over_stock !== true) {
      return res.status(409).json({
        error: describeShortfalls(shortfalls),
        over_stock: shortfalls,
      });
    }

    const now = Date.now();
    const id = ulid();
    const orderType = ORDER_TYPES.has(body.order_type) ? body.order_type : 'walkin';
    const customerId = resolveCustomer(db, body);

    // A sale may be filed on an earlier day (backdated entry). Future dates are
    // refused so reports never count money that has not happened yet.
    const placedAt = Number(body.placed_at) || now;
    if (!Number.isFinite(placedAt) || placedAt <= 0) {
      return res.status(400).json({ error: 'Invalid date of sale.' });
    }
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (placedAt > endOfToday.getTime()) {
      return res.status(400).json({ error: 'Date of sale cannot be in the future.' });
    }

    const order = {
      id,
      customer_id: customerId,
      customer_name: body.customer_name ? String(body.customer_name).trim() : null,
      customer_phone: body.customer_phone ? String(body.customer_phone).trim() : null,
      order_type: orderType,
      source: body.source === 'customer' ? 'customer' : 'admin',
      is_preorder: body.is_preorder ? 1 : 0,
      fulfillment_status: FULFILLMENT.has(body.fulfillment_status) ? body.fulfillment_status : 'pending',
      payment_status: 'unpaid',
      subtotal_cents: 0,
      ...readDiscountFields(body),
      delivery_fee_cents: orderType === 'delivery' ? Math.round(Number(body.delivery_fee_cents) || 0) : 0,
      total_cents: 0,
      amount_paid_cents: 0,
      due_date: body.due_date ? Number(body.due_date) : null,
      address: body.address ? String(body.address).trim() : null,
      note: body.note ? String(body.note).trim() : null,
      placed_at: placedAt,
      delivered_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    db.prepare(
      'INSERT INTO orders (id, customer_id, customer_name, customer_phone, order_type, source, is_preorder, ' +
        'fulfillment_status, payment_status, subtotal_cents, discount_cents, discount_percent, discount_reason, ' +
        'delivery_fee_cents, total_cents, amount_paid_cents, due_date, address, note, placed_at, delivered_at, ' +
        'created_at, updated_at, deleted_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)',
    ).run(
      order.id,
      order.customer_id,
      order.customer_name,
      order.customer_phone,
      order.order_type,
      order.source,
      order.is_preorder,
      order.fulfillment_status,
      order.payment_status,
      order.subtotal_cents,
      order.discount_cents,
      order.discount_percent,
      order.discount_reason,
      order.delivery_fee_cents,
      order.total_cents,
      order.amount_paid_cents,
      order.due_date,
      order.address,
      order.note,
      order.placed_at,
      order.created_at,
      order.updated_at,
    );
    recordInsert('orders', order);

    const createdItems = buildItems(db, id, rawItems);

    // What the customer hands over is treated as cash received: we only ever
    // record what is actually owed and hand the difference back as change.
    const totalDue =
      createdItems.reduce((sum, item) => sum + item.line_total_cents, 0) +
      Number(order.delivery_fee_cents ?? 0);
    const cashReceived = Math.round(Number(body.initial_payment_cents ?? body.tendered_cents) || 0);

    let acceptedCents = 0;
    let changeCents = 0;

    if (cashReceived > 0) {
      acceptedCents = Math.min(cashReceived, totalDue);
      changeCents = cashReceived - acceptedCents;
      addPayment(db, id, {
        amount_cents: acceptedCents,
        tendered_cents: cashReceived,
        method: body.payment_method || 'cash',
        paid_at: order.placed_at || now,
        note: 'Initial payment',
      });
    }

    recalcOrder(db, id);
    const saved = getOrder(db, id);
    recordUpdate('orders', saved);
    syncSaleStock(db, saved);

    return res
      .status(201)
      .json({ ...fullOrder(db, id), accepted_cents: acceptedCents, change_cents: changeCents });
  });

  api.put('/orders/:id', (req, res) => {
    const existing = getOrder(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const body = req.body ?? {};
    const next = { ...existing };

    if (body.fulfillment_status && FULFILLMENT.has(body.fulfillment_status)) {
      next.fulfillment_status = body.fulfillment_status;
      if (SOLD_STATUSES.has(body.fulfillment_status) && !existing.delivered_at) {
        next.delivered_at = Date.now();
      }
    }
    if (body.order_type && ORDER_TYPES.has(body.order_type)) next.order_type = body.order_type;
    if (body.customer_name !== undefined) next.customer_name = body.customer_name ? String(body.customer_name).trim() : null;
    if (body.customer_phone !== undefined) next.customer_phone = body.customer_phone ? String(body.customer_phone).trim() : null;
    if (body.address !== undefined) next.address = body.address ? String(body.address).trim() : null;
    if (body.note !== undefined) next.note = body.note ? String(body.note).trim() : null;
    if (body.due_date !== undefined) next.due_date = body.due_date ? Number(body.due_date) : null;
    if (body.is_preorder !== undefined) next.is_preorder = body.is_preorder ? 1 : 0;
    if (body.delivery_fee_cents !== undefined) {
      next.delivery_fee_cents =
        next.order_type === 'delivery' ? Math.round(Number(body.delivery_fee_cents) || 0) : 0;
    }
    if (
      body.discount_cents !== undefined ||
      body.discount_percent !== undefined ||
      body.discount_reason !== undefined
    ) {
      // Merge the incoming values over the current ones, then normalise.
      Object.assign(next, readDiscountFields({ ...next, ...body }));
    }

    db.prepare(
      'UPDATE orders SET customer_name = ?, customer_phone = ?, order_type = ?, is_preorder = ?, ' +
        'fulfillment_status = ?, delivery_fee_cents = ?, discount_cents = ?, discount_percent = ?, ' +
        'discount_reason = ?, due_date = ?, address = ?, note = ?, delivered_at = ?, updated_at = ? ' +
        'WHERE id = ?',
    ).run(
      next.customer_name,
      next.customer_phone,
      next.order_type,
      next.is_preorder,
      next.fulfillment_status,
      next.delivery_fee_cents,
      next.discount_cents ?? 0,
      next.discount_percent ?? 0,
      next.discount_reason ?? null,
      next.due_date,
      next.address,
      next.note,
      next.delivered_at,
      Date.now(),
      existing.id,
    );

    if (Array.isArray(body.items) && body.items.length) {
      const shortfalls = stockShortfalls(db, body.items);
      if (shortfalls.length && body.allow_over_stock !== true) {
        return res.status(409).json({
          error: describeShortfalls(shortfalls),
          over_stock: shortfalls,
        });
      }

      const now = Date.now();
      const oldItems = getItems(db, existing.id);

      // Keep the price each product was ALREADY sold at on this order, so
      // replacing the lines cannot rewrite what the customer was charged.
      // Products not previously on the order are priced at today's catalogue.
      const soldPrices = new Map();
      for (const item of oldItems) {
        if (item.product_id && !soldPrices.has(item.product_id)) {
          soldPrices.set(item.product_id, Number(item.unit_price_cents) || 0);
        }
      }

      db.prepare('UPDATE order_items SET deleted_at = ?, updated_at = ? WHERE order_id = ? AND deleted_at IS NULL').run(
        now,
        now,
        existing.id,
      );
      for (const item of oldItems) {
        recordDelete('order_items', { ...item, deleted_at: now, updated_at: now });
      }
      buildItems(db, existing.id, body.items, soldPrices);
    }

    const saved = recalcOrder(db, existing.id);
    recordUpdate('orders', saved);
    syncSaleStock(db, saved);

    return res.json(fullOrder(db, existing.id));
  });

  api.delete('/orders/:id', (req, res) => {
    const existing = getOrder(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const now = Date.now();
    db.prepare('UPDATE orders SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, existing.id);
    recordDelete('orders', { ...existing, deleted_at: now, updated_at: now });

    // Put any deducted stock back, then retire the child rows so nothing is orphaned.
    removeSaleStock(db, existing.id);

    for (const item of getItems(db, existing.id)) {
      db.prepare('UPDATE order_items SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
        now,
        now,
        item.id,
      );
      recordDelete('order_items', { ...item, deleted_at: now, updated_at: now });
    }

    for (const payment of getPayments(db, existing.id)) {
      db.prepare('UPDATE payments SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
        now,
        now,
        payment.id,
      );
      recordDelete('payments', { ...payment, deleted_at: now, updated_at: now });
    }

    return res.json({ ok: true });
  });

  api.post('/orders/:id/payments', (req, res) => {
    const order = getOrder(db, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const body = req.body ?? {};
    // The UI sends what the customer handed over. We record only what is owed
    // and return the difference as change.
    const cashReceived = Math.round(Number(body.tendered_cents ?? body.amount_cents) || 0);
    if (cashReceived <= 0) {
      return res.status(400).json({ error: 'Enter an amount greater than zero.' });
    }

    const due = outstandingCents(order);
    if (due <= 0) return res.status(400).json({ error: 'This order is already fully paid.' });

    const accepted = Math.min(cashReceived, due);
    const change = cashReceived - accepted;

    addPayment(db, order.id, {
      amount_cents: accepted,
      tendered_cents: cashReceived,
      method: body.method || 'cash',
      paid_at: Number(body.paid_at) || Date.now(),
      note: body.note ? String(body.note).trim() : null,
    });

    const saved = recalcOrder(db, order.id);
    recordUpdate('orders', saved);
    return res
      .status(201)
      .json({ ...fullOrder(db, order.id), accepted_cents: accepted, change_cents: change });
  });

  api.delete('/orders/:id/payments/:paymentId', (req, res) => {
    const payment = db
      .prepare('SELECT * FROM payments WHERE id = ? AND order_id = ? AND deleted_at IS NULL')
      .get(req.params.paymentId, req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    const now = Date.now();
    db.prepare('UPDATE payments SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, payment.id);
    recordDelete('payments', { ...payment, deleted_at: now, updated_at: now });

    const saved = recalcOrder(db, req.params.id);
    recordUpdate('orders', saved);
    return res.json(fullOrder(db, req.params.id));
  });
}

/** Payment helper shared by order creation and the payments endpoint. */
export function addPayment(db, orderId, { amount_cents, tendered_cents, method, paid_at, note }) {
  const amount = Math.round(Number(amount_cents) || 0);
  // Cash handed over is never less than what we actually record.
  const tendered = Math.max(amount, Math.round(Number(tendered_cents) || 0));

  const payment = {
    id: ulid(),
    order_id: orderId,
    amount_cents: amount,
    tendered_cents: tendered,
    method: method || 'cash',
    paid_at: Number(paid_at) || Date.now(),
    note: note ?? null,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
  };

  db.prepare(
    'INSERT INTO payments (id, order_id, amount_cents, tendered_cents, method, paid_at, note, created_at, updated_at, deleted_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
  ).run(
    payment.id,
    payment.order_id,
    payment.amount_cents,
    payment.tendered_cents,
    payment.method,
    payment.paid_at,
    payment.note,
    payment.created_at,
    payment.updated_at,
  );
  recordInsert('payments', payment);
  return payment;
}

/** How much is still owed on an order. */
export function outstandingCents(order) {
  return Math.max(0, Number(order?.total_cents ?? 0) - Number(order?.amount_paid_cents ?? 0));
}

/**
 * Which tracked lines ask for more than we have on hand?
 *
 * Refills and other untracked products are never flagged - they are a service,
 * so there is no stock to run out of.
 *
 * @returns {Array<{name:string, requested:number, available:number}>}
 */
export function stockShortfalls(db, items) {
  const shortfalls = [];

  for (const item of items) {
    const productId = item.product_id ? String(item.product_id) : null;
    const qty = Math.round(Number(item.qty) || 0);
    if (!productId || qty <= 0) continue;

    const row = db
      .prepare(
        `SELECT p.name, p.track_stock,
                COALESCE((SELECT SUM(l.change_qty) FROM inventory_logs l
                          WHERE l.product_id = p.id AND l.deleted_at IS NULL), 0) AS on_hand
         FROM products p WHERE p.id = ?`,
      )
      .get(productId);

    if (!row) continue;
    if (Number(row.track_stock) !== 1) continue;

    const available = Math.max(0, Number(row.on_hand) || 0);
    if (qty > available) shortfalls.push({ name: row.name, requested: qty, available });
  }

  return shortfalls;
}

/** A readable sentence for the 409 response. */
function describeShortfalls(shortfalls) {
  return shortfalls
    .map((item) =>
      item.available <= 0
        ? `${item.name} is out of stock`
        : `only ${item.available} × ${item.name} available (you asked for ${item.requested})`,
    )
    .join('; ');
}
