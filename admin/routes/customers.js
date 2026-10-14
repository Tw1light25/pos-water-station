/**
 * Customers - records, per-customer notes and outstanding balances.
 *
 * The balance is derived from orders (total minus paid) so it stays correct
 * once orders and payments exist.
 */

import express from 'express';
import { ulid } from '../../shared/ids.js';
import { recordDelete, recordInsert, recordUpdate } from '../sync/outbox.js';

const BALANCE_SQL = `COALESCE((SELECT SUM(o.total_cents - o.amount_paid_cents) FROM orders o
  WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND o.payment_status <> 'paid'), 0)`;

const ORDERS_SQL =
  '(SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.deleted_at IS NULL)';

function getCustomer(db, id) {
  return db
    .prepare(
      `SELECT c.*, ${BALANCE_SQL} AS balance_cents, ${ORDERS_SQL} AS orders_count
       FROM customers c WHERE c.id = ? AND c.deleted_at IS NULL`,
    )
    .get(id);
}

export function mountCustomerRoutes(api, db) {
  api.get('/customers', (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const clauses = ['c.deleted_at IS NULL'];
    const params = [];

    if (search) {
      clauses.push('(c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const rows = db
      .prepare(
        `SELECT c.*, ${BALANCE_SQL} AS balance_cents, ${ORDERS_SQL} AS orders_count
         FROM customers c WHERE ${clauses.join(' AND ')}
         ORDER BY c.name COLLATE NOCASE`,
      )
      .all(...params);

    res.json({ customers: rows });
  });

  api.get('/customers/:id', (req, res) => {
    const customer = getCustomer(db, req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const orders = db
      .prepare(
        `SELECT id, placed_at, order_type, fulfillment_status, payment_status,
                total_cents, amount_paid_cents
         FROM orders WHERE customer_id = ? AND deleted_at IS NULL
         ORDER BY placed_at DESC LIMIT 50`,
      )
      .all(req.params.id);

    return res.json({ customer, orders });
  });

  api.post('/customers', (req, res) => {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Customer name is required.' });

    const now = Date.now();
    const id = ulid();
    db.prepare(
      'INSERT INTO customers (id, name, phone, address, facebook, notes, created_at, updated_at, deleted_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    ).run(
      id,
      name,
      body.phone ? String(body.phone).trim() : null,
      body.address ? String(body.address).trim() : null,
      body.facebook ? String(body.facebook).trim() : null,
      body.notes ? String(body.notes).trim() : null,
      now,
      now,
    );
    recordInsert('customers', getCustomer(db, id));

    return res.status(201).json({ customer: getCustomer(db, id) });
  });

  api.put('/customers/:id', (req, res) => {
    const existing = getCustomer(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found.' });

    const body = req.body ?? {};
    const name = body.name === undefined ? existing.name : String(body.name).trim();
    if (!name) return res.status(400).json({ error: 'Customer name is required.' });

    const clean = (value, fallback) =>
      value === undefined ? fallback : value ? String(value).trim() : null;

    db.prepare(
      'UPDATE customers SET name = ?, phone = ?, address = ?, facebook = ?, notes = ?, updated_at = ? WHERE id = ?',
    ).run(
      name,
      clean(body.phone, existing.phone),
      clean(body.address, existing.address),
      clean(body.facebook, existing.facebook),
      clean(body.notes, existing.notes),
      Date.now(),
      existing.id,
    );

    const fresh = getCustomer(db, existing.id);
    recordUpdate('customers', fresh);
    return res.json({ customer: fresh });
  });

  api.delete('/customers/:id', (req, res) => {
    const existing = getCustomer(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found.' });

    const now = Date.now();
    db.prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      existing.id,
    );
    recordDelete('customers', { ...existing, deleted_at: now, updated_at: now });
    return res.json({ ok: true });
  });
}
