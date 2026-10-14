/**
 * POST /api/orders
 *
 * A guest order from the customer site.
 *
 *  - The client generates the order id (ULID), so retrying a request after a
 *    dropped connection can never create a duplicate: the same id returns the
 *    existing order.
 *  - Prices are always taken from the database, never from the request.
 *  - Orders placed while the store is closed are flagged as pre-orders.
 */

import { query, parseJson, getPool } from '../lib/db.js';
import { fail, handler, json, readJson } from '../lib/http.js';
import { computeStoreStatus } from '../../shared/store-status.js';
import { isUlid, ulid } from '../../shared/ids.js';

export const config = { path: '/api/orders' };

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 12;

  const entry = hits.get(ip) ?? { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > max;
}

export default handler(async (request) => {
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  const ip = request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (rateLimited(ip)) {
    return fail('Too many orders from this connection. Please try again in a minute.', 429);
  }

  const body = await readJson(request);
  const id = String(body.id ?? '').trim();
  if (!isUlid(id)) return fail('A valid order id is required.');

  // Idempotency: the same id simply returns what already exists.
  const existing = await query(
    'SELECT id, total_cents, amount_paid_cents, fulfillment_status, payment_status, placed_at FROM orders WHERE id = ?',
    [id],
  );
  if (existing.length) {
    return json({ order: withCode(existing[0]), duplicate: true });
  }

  const customerName = String(body.customer_name ?? '').trim() || null;
  const customerPhone = String(body.customer_phone ?? '').trim();
  if (customerPhone.replace(/\D/g, '').length < 7) {
    return fail('Please enter a valid phone number.');
  }

  const orderType = body.order_type === 'delivery' ? 'delivery' : 'walkin';
  const address = String(body.address ?? '').trim() || null;
  if (orderType === 'delivery' && !address) {
    return fail('A delivery address is required for delivery orders.');
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const wantedIds = [...new Set(rawItems.map((item) => String(item.product_id ?? '')).filter(Boolean))];
  if (!wantedIds.length) return fail('Please add at least one item.');

  const products = await query(
    `SELECT p.id, p.name, p.unit, p.price_cents, p.track_stock,
            COALESCE((SELECT SUM(l.change_qty) FROM inventory_logs l
                      WHERE l.product_id = p.id AND l.deleted_at IS NULL), 0) AS on_hand
     FROM products p
     WHERE p.deleted_at IS NULL AND p.active = 1
       AND p.id IN (${wantedIds.map(() => '?').join(',')})`,
    wantedIds,
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  const items = [];
  const outOfStock = [];
  const overStock = [];

  for (const raw of rawItems) {
    const product = byId.get(String(raw.product_id ?? ''));
    const qty = Math.max(1, Math.min(999, Math.round(Number(raw.qty) || 0)));
    if (!product || !qty) continue;

    // Never sell beyond what is on hand - but a refill is a service, so it is
    // never out of stock and never quantity-capped.
    const tracked = Number(product.track_stock) === 1;
    const available = Math.max(0, Number(product.on_hand) || 0);

    if (tracked) {
      if (available <= 0) {
        outOfStock.push(product.name);
        continue;
      }
      if (qty > available) {
        overStock.push(`${available} × ${product.name}`);
        continue;
      }
    }

    const unitPrice = Number(product.price_cents) || 0;
    items.push({
      id: ulid(),
      product_id: product.id,
      product_name: product.name,
      unit: product.unit,
      qty,
      unit_price_cents: unitPrice,
      line_total_cents: unitPrice * qty,
    });
  }

  if (outOfStock.length) {
    return fail(
      `Sorry, ${joinList(outOfStock)} ${outOfStock.length === 1 ? 'is' : 'are'} out of stock right now.`,
    );
  }
  if (overStock.length) {
    return fail(`Only ${joinList(overStock)} available right now - please lower the quantity.`);
  }
  if (!items.length) return fail('Sorry, those products are not available right now.');

  const settingsRows = await query(
    'SELECT * FROM settings WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1',
  );
  const settings = settingsRows[0] ?? {};
  const status = computeStoreStatus({
    override: settings.store_override,
    hours: parseJson(settings.hours_json, null),
    timezone: settings.timezone,
  });

  const subtotal = items.reduce((sum, item) => sum + item.line_total_cents, 0);
  const deliveryFee = orderType === 'delivery' ? Number(settings.delivery_fee_cents ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const now = Date.now();

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    // Link to an existing customer by phone, or create one.
    let customerId = null;
    const [customers] = await connection.query(
      'SELECT id FROM customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1',
      [customerPhone],
    );
    if (customers.length) {
      customerId = customers[0].id;
    } else if (customerName) {
      customerId = ulid();
      await connection.query(
        'INSERT INTO customers (id, name, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, customerName, customerPhone, address, now, now],
      );
    }

    await connection.query(
      'INSERT INTO orders (id, customer_id, customer_name, customer_phone, order_type, source, is_preorder, ' +
        'fulfillment_status, payment_status, subtotal_cents, delivery_fee_cents, total_cents, amount_paid_cents, ' +
        'address, note, placed_at, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        customerId,
        customerName,
        customerPhone,
        orderType,
        'customer',
        status.isOpen ? 0 : 1,
        'pending',
        'unpaid',
        subtotal,
        deliveryFee,
        total,
        0,
        address,
        String(body.note ?? '').trim() || null,
        now,
        now,
        now,
      ],
    );

    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (id, order_id, product_id, product_name, unit, qty, unit_price_cents, ' +
          'line_total_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          item.id,
          id,
          item.product_id,
          item.product_name,
          item.unit,
          item.qty,
          item.unit_price_cents,
          item.line_total_cents,
          now,
          now,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return json(
    {
      order: withCode({
        id,
        total_cents: total,
        amount_paid_cents: 0,
        fulfillment_status: 'pending',
        payment_status: 'unpaid',
        placed_at: now,
      }),
      preorder: !status.isOpen,
      closed_message: status.isOpen ? null : settings.closed_message ?? null,
    },
    201,
  );
});

function withCode(order) {
  return { ...order, code: String(order.id).slice(-6).toUpperCase() };
}

/** "a", "a and b", "a, b and c" */
function joinList(names) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
