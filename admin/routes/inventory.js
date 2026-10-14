/**
 * Inventory.
 *
 * Stock is never a stored number: `on_hand` is the SUM of the append-only
 * `inventory_logs` ledger. Receiving stock or correcting a count just adds a
 * ledger row, which is what makes offline merges safe.
 */

import express from 'express';
import { recordDelete } from '../sync/outbox.js';
import { insertInventoryLog } from './products.js';

const REASONS = ['receive', 'sale', 'adjustment', 'return', 'damage', 'initial'];

function stockRows(db) {
  return db
    .prepare(
      `SELECT p.id, p.name, p.unit, p.category, p.price_cents, p.reorder_level, p.active, p.track_stock,
              COALESCE((SELECT SUM(l.change_qty) FROM inventory_logs l
                        WHERE l.product_id = p.id AND l.deleted_at IS NULL), 0) AS on_hand
       FROM products p
       WHERE p.deleted_at IS NULL AND p.track_stock = 1
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all()
    .map((row) => ({
      ...row,
      active: Number(row.active) === 1,
      on_hand: Number(row.on_hand ?? 0),
      stock_value_cents: Number(row.on_hand ?? 0) * Number(row.price_cents ?? 0),
    }));
}

export function mountInventoryRoutes(api, db) {
  api.get('/inventory', (req, res) => {
    const items = stockRows(db);
    const lowStock = items.filter(
      (item) => item.active && item.reorder_level > 0 && item.on_hand <= item.reorder_level,
    );

    res.json({
      items,
      summary: {
        products: items.length,
        units: items.reduce((total, item) => total + item.on_hand, 0),
        stock_value_cents: items.reduce((total, item) => total + item.stock_value_cents, 0),
        low_stock: lowStock.length,
        out_of_stock: items.filter((item) => item.on_hand <= 0).length,
      },
    });
  });

  api.get('/inventory/movements', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const productId = req.query.product_id ? String(req.query.product_id) : null;

    const clauses = ['l.deleted_at IS NULL'];
    const params = [];
    if (productId) {
      clauses.push('l.product_id = ?');
      params.push(productId);
    }

    const rows = db
      .prepare(
        `SELECT l.*, p.name AS product_name, p.unit AS product_unit
         FROM inventory_logs l
         LEFT JOIN products p ON p.id = l.product_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY l.created_at DESC
         LIMIT ${limit}`,
      )
      .all(...params);

    res.json({ movements: rows, reasons: REASONS });
  });

  api.post('/inventory/movements', (req, res) => {
    const body = req.body ?? {};
    const productId = String(body.product_id ?? '').trim();
    const changeQty = Math.round(Number(body.change_qty) || 0);

    if (!productId) return res.status(400).json({ error: 'Pick a product.' });
    if (!changeQty) return res.status(400).json({ error: 'Quantity change cannot be zero.' });

    const product = db
      .prepare('SELECT id, name, track_stock FROM products WHERE id = ? AND deleted_at IS NULL')
      .get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (Number(product.track_stock) !== 1) {
      return res
        .status(400)
        .json({ error: `${product.name} is not stock-tracked (a refill or a service).` });
    }

    const reason = REASONS.includes(body.reason) ? body.reason : 'adjustment';
    const log = insertInventoryLog(db, {
      productId,
      changeQty,
      reason,
      note: body.note ? String(body.note).trim() : null,
    });

    return res.status(201).json({ movement: { ...log, product_name: product.name } });
  });

  api.delete('/inventory/movements/:id', (req, res) => {
    const existing = db
      .prepare('SELECT * FROM inventory_logs WHERE id = ? AND deleted_at IS NULL')
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Movement not found.' });

    const now = Date.now();
    db.prepare('UPDATE inventory_logs SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      existing.id,
    );
    recordDelete('inventory_logs', { ...existing, deleted_at: now, updated_at: now });
    return res.json({ ok: true });
  });
}
