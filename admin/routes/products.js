/**
 * Product catalogue.
 *
 * On-hand stock is never stored on the product row - it is derived from the
 * append-only `inventory_logs` ledger, so it stays correct across offline
 * devices.
 */

import express from 'express';
import { ulid } from '../../shared/ids.js';
import { recordDelete, recordInsert, recordUpdate } from '../sync/outbox.js';

const ON_HAND =
  'COALESCE((SELECT SUM(l.change_qty) FROM inventory_logs l ' +
  'WHERE l.product_id = p.id AND l.deleted_at IS NULL), 0)';

const SELECT_ONE = `
  SELECT p.*, ${ON_HAND} AS on_hand
  FROM products p
  WHERE p.id = ?`;

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    active: Number(row.active) === 1,
    track_stock: Number(row.track_stock) === 1,
    on_hand: Number(row.on_hand ?? 0),
  };
}

function getProduct(db, id) {
  return db.prepare(SELECT_ONE).get(id);
}

/** "Refill" is a service, not stock - everything else is counted by default. */
function defaultTrackStock(category) {
  return String(category ?? '').trim().toLowerCase() === 'refill' ? 0 : 1;
}

function readBody(body) {
  const category = body.category ? String(body.category).trim() : null;

  let trackStock;
  if (body.track_stock === undefined || body.track_stock === null) {
    trackStock = defaultTrackStock(category);
  } else {
    trackStock = body.track_stock === true || body.track_stock === 1 || body.track_stock === '1' ? 1 : 0;
  }

  return {
    name: String(body.name ?? '').trim(),
    unit: String(body.unit ?? 'pc').trim() || 'pc',
    category,
    price_cents: Math.round(Number(body.price_cents) || 0),
    reorder_level: Math.round(Number(body.reorder_level) || 0),
    active: body.active === false || body.active === 0 ? 0 : 1,
    track_stock: trackStock,
  };
}

export function insertInventoryLog(db, { productId, changeQty, reason, note, reference = null, at = Date.now() }) {
  const log = {
    id: ulid(),
    product_id: productId,
    change_qty: Math.round(Number(changeQty) || 0),
    reason,
    reference,
    note: note ?? null,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  db.prepare(
    'INSERT INTO inventory_logs (id, product_id, change_qty, reason, reference, note, created_at, updated_at, deleted_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    log.id,
    log.product_id,
    log.change_qty,
    log.reason,
    log.reference,
    log.note,
    log.created_at,
    log.updated_at,
    log.deleted_at,
  );
  recordInsert('inventory_logs', log);
  return log;
}

export function mountProductRoutes(api, db) {
  api.get('/products', (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const includeInactive = req.query.all === '1';

    const clauses = ['p.deleted_at IS NULL'];
    const params = [];
    if (!includeInactive) clauses.push('p.active = 1');
    if (search) {
      clauses.push('(p.name LIKE ? OR p.category LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const rows = db
      .prepare(
        `SELECT p.*, ${ON_HAND} AS on_hand FROM products p ` +
          `WHERE ${clauses.join(' AND ')} ORDER BY p.name COLLATE NOCASE`,
      )
      .all(...params);

    res.json({ products: rows.map(hydrate) });
  });

  api.post('/products', (req, res) => {
    const fields = readBody(req.body ?? {});
    if (!fields.name) return res.status(400).json({ error: 'Product name is required.' });

    const now = Date.now();
    const id = ulid();
    db.prepare(
      'INSERT INTO products (id, name, unit, category, price_cents, reorder_level, active, track_stock, created_at, updated_at, deleted_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    ).run(
      id,
      fields.name,
      fields.unit,
      fields.category,
      fields.price_cents,
      fields.reorder_level,
      fields.active,
      fields.track_stock,
      now,
      now,
    );
    recordInsert('products', getProduct(db, id));

    const initialStock = Math.round(Number(req.body?.initial_stock) || 0);
    if (initialStock !== 0) {
      insertInventoryLog(db, {
        productId: id,
        changeQty: initialStock,
        reason: 'initial',
        note: 'Opening stock',
        at: now,
      });
    }

    return res.status(201).json({ product: hydrate(getProduct(db, id)) });
  });

  api.put('/products/:id', (req, res) => {
    const existing = getProduct(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const fields = readBody({ ...existing, ...req.body });
    if (!fields.name) return res.status(400).json({ error: 'Product name is required.' });

    db.prepare(
      'UPDATE products SET name = ?, unit = ?, category = ?, price_cents = ?, reorder_level = ?, active = ?, track_stock = ?, updated_at = ? WHERE id = ?',
    ).run(
      fields.name,
      fields.unit,
      fields.category,
      fields.price_cents,
      fields.reorder_level,
      fields.active,
      fields.track_stock,
      Date.now(),
      existing.id,
    );

    const fresh = getProduct(db, existing.id);
    recordUpdate('products', fresh);
    return res.json({ product: hydrate(fresh) });
  });

  api.delete('/products/:id', (req, res) => {
    const existing = getProduct(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const now = Date.now();
    db.prepare('UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      existing.id,
    );
    recordDelete('products', getProduct(db, existing.id));
    return res.json({ ok: true });
  });
}
