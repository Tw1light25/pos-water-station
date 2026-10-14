/**
 * Expenses - free-form outgoing money.
 *
 * Amounts are not tied to the catalogue: the owner types whatever was spent
 * (maintenance, rent, fuel, ...). These rows feed the "outgoing money" graph.
 */

import express from 'express';
import { ulid } from '../../shared/ids.js';
import { recordDelete, recordInsert, recordUpdate } from '../sync/outbox.js';

const SUGGESTED_CATEGORIES = [
  'general',
  'maintenance',
  'rent',
  'utilities',
  'supplies',
  'salary',
  'transport',
  'equipment',
];

function getExpense(db, id) {
  return db.prepare('SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL').get(id);
}

export function mountExpenseRoutes(api, db) {
  api.get('/expenses', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const clauses = ['deleted_at IS NULL'];
    const params = [];

    if (req.query.category) {
      clauses.push('category = ?');
      params.push(String(req.query.category));
    }
    if (req.query.from) {
      clauses.push('spent_at >= ?');
      params.push(Number(req.query.from));
    }
    if (req.query.to) {
      clauses.push('spent_at <= ?');
      params.push(Number(req.query.to));
    }
    if (req.query.search) {
      clauses.push('(description LIKE ? OR note LIKE ?)');
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }

    const rows = db
      .prepare(
        `SELECT * FROM expenses WHERE ${clauses.join(' AND ')} ORDER BY spent_at DESC LIMIT ${limit}`,
      )
      .all(...params);

    const total = rows.reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);

    const categoryRows = db
      .prepare(
        `SELECT category, SUM(amount_cents) AS total_cents, COUNT(*) AS count
         FROM expenses WHERE deleted_at IS NULL GROUP BY category ORDER BY total_cents DESC`,
      )
      .all();

    res.json({
      expenses: rows,
      total_cents: total,
      by_category: categoryRows,
      categories: SUGGESTED_CATEGORIES,
    });
  });

  api.post('/expenses', (req, res) => {
    const body = req.body ?? {};
    const description = String(body.description ?? '').trim();
    const amount = Math.round(Number(body.amount_cents) || 0);
    if (!description) return res.status(400).json({ error: 'Description is required.' });
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero.' });

    const now = Date.now();
    const row = {
      id: ulid(),
      description,
      amount_cents: amount,
      category: String(body.category ?? 'general').trim() || 'general',
      spent_at: Number(body.spent_at) || now,
      note: body.note ? String(body.note).trim() : null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    db.prepare(
      'INSERT INTO expenses (id, description, amount_cents, category, spent_at, note, created_at, updated_at, deleted_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    ).run(
      row.id,
      row.description,
      row.amount_cents,
      row.category,
      row.spent_at,
      row.note,
      row.created_at,
      row.updated_at,
    );
    recordInsert('expenses', row);

    return res.status(201).json({ expense: getExpense(db, row.id) });
  });

  api.put('/expenses/:id', (req, res) => {
    const existing = getExpense(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Expense not found.' });

    const body = req.body ?? {};
    const description = body.description === undefined ? existing.description : String(body.description).trim();
    const amount =
      body.amount_cents === undefined ? existing.amount_cents : Math.round(Number(body.amount_cents) || 0);

    if (!description) return res.status(400).json({ error: 'Description is required.' });
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero.' });

    db.prepare(
      'UPDATE expenses SET description = ?, amount_cents = ?, category = ?, spent_at = ?, note = ?, updated_at = ? WHERE id = ?',
    ).run(
      description,
      amount,
      body.category === undefined ? existing.category : String(body.category).trim() || 'general',
      body.spent_at === undefined ? existing.spent_at : Number(body.spent_at) || existing.spent_at,
      body.note === undefined ? existing.note : body.note ? String(body.note).trim() : null,
      Date.now(),
      existing.id,
    );

    const fresh = getExpense(db, existing.id);
    recordUpdate('expenses', fresh);
    return res.json({ expense: fresh });
  });

  api.delete('/expenses/:id', (req, res) => {
    const existing = getExpense(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Expense not found.' });

    const now = Date.now();
    db.prepare('UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      existing.id,
    );
    recordDelete('expenses', { ...existing, deleted_at: now, updated_at: now });
    return res.json({ ok: true });
  });
}
