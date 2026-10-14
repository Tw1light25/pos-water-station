/**
 * Category pick lists.
 *
 * Two independent lists live in one table, separated by `kind`:
 *   kind = 'product'  -> the catalogue  (Refill, Container, Bottled, ...)
 *   kind = 'expense'  -> outgoing money (maintenance, rent, ...)
 *
 * Anything already used by a product or expense is "adopted" into the table on
 * read, so every entry in a dropdown has a real row that can be renamed or
 * removed - without needing a data migration.
 */

import express from 'express';
import { ulid } from '../../shared/ids.js';
import { DEFAULT_CATEGORY_NAMES } from '../../shared/categories.js';
import { recordDelete, recordInsert, recordUpdate } from '../sync/outbox.js';

/** kind -> the table whose rows reference a category by name */
const DEPENDENT = { product: 'products', expense: 'expenses' };
const LABEL = { product: 'product', expense: 'expense' };

function normalizeKind(value) {
  return Object.prototype.hasOwnProperty.call(DEPENDENT, value) ? value : 'product';
}

const findById = (db, id) =>
  db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id);

const findByName = (db, kind, name) =>
  db
    .prepare('SELECT * FROM categories WHERE kind = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL')
    .get(kind, String(name).trim());

function listCategories(db, kind) {
  return db
    .prepare(
      'SELECT * FROM categories WHERE kind = ? AND deleted_at IS NULL ORDER BY sort_order, name COLLATE NOCASE',
    )
    .all(kind);
}

function nextSortOrder(db, kind) {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories WHERE kind = ?').get(kind);
  return Number(row?.m ?? 0) + 1;
}

function usedNames(db, kind) {
  const table = DEPENDENT[kind];
  return db
    .prepare(
      `SELECT DISTINCT category AS name FROM "${table}"
       WHERE deleted_at IS NULL AND category IS NOT NULL AND TRIM(category) <> ''`,
    )
    .all()
    .map((row) => String(row.name));
}

/** Make sure every category currently in use has a row, so it can be managed. */
function adoptInUseCategories(db, kind) {
  const existing = new Set(listCategories(db, kind).map((row) => row.name.toLowerCase()));
  const now = Date.now();
  let order = nextSortOrder(db, kind);
  let adopted = 0;

  for (const name of usedNames(db, kind)) {
    if (existing.has(name.toLowerCase())) continue;

    const row = {
      id: ulid(),
      kind,
      name,
      sort_order: order,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    db.prepare(
      'INSERT INTO categories (id, kind, name, sort_order, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
    ).run(row.id, row.kind, row.name, row.sort_order, row.created_at, row.updated_at);
    recordInsert('categories', row);

    existing.add(name.toLowerCase());
    order += 1;
    adopted += 1;
  }

  return adopted;
}

/** Give a kind its starter list (used by the seeder and by an empty install). */
export function ensureDefaultCategories(db, kind = null) {
  const kinds = kind ? [normalizeKind(kind)] : Object.keys(DEPENDENT);
  let created = 0;
  const now = Date.now();

  for (const current of kinds) {
    const existing = new Set(listCategories(db, current).map((row) => row.name.toLowerCase()));
    let order = nextSortOrder(db, current);

    for (const name of DEFAULT_CATEGORY_NAMES[current]) {
      if (existing.has(name.toLowerCase())) continue;
      const row = {
        id: ulid(),
        kind: current,
        name,
        sort_order: order,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      db.prepare(
        'INSERT INTO categories (id, kind, name, sort_order, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
      ).run(row.id, row.kind, row.name, row.sort_order, row.created_at, row.updated_at);
      recordInsert('categories', row);
      existing.add(name.toLowerCase());
      order += 1;
      created += 1;
    }
  }

  return created;
}

export function mountCategoryRoutes(api, db) {
  api.get('/categories', (req, res) => {
    const kind = normalizeKind(req.query.kind);
    adoptInUseCategories(db, kind);
    res.json({ categories: listCategories(db, kind) });
  });

  api.post('/categories', (req, res) => {
    const kind = normalizeKind(req.body?.kind);
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Enter a category name.' });

    const existing = findByName(db, kind, name);
    if (existing) return res.json({ category: existing, existed: true });

    const now = Date.now();
    const row = {
      id: ulid(),
      kind,
      name,
      sort_order: nextSortOrder(db, kind),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    db.prepare(
      'INSERT INTO categories (id, kind, name, sort_order, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
    ).run(row.id, row.kind, row.name, row.sort_order, row.created_at, row.updated_at);
    recordInsert('categories', row);

    return res.status(201).json({ category: findById(db, row.id) });
  });

  api.put('/categories/:id', (req, res) => {
    const current = findById(db, req.params.id);
    if (!current) return res.status(404).json({ error: 'Category not found.' });

    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Enter a category name.' });

    if (name.toLowerCase() === String(current.name).toLowerCase()) {
      return res.json({ category: current, renamed: 0 });
    }

    const clash = findByName(db, current.kind, name);
    if (clash) return res.status(400).json({ error: `"${name}" already exists.` });

    const now = Date.now();
    db.prepare('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?').run(name, now, current.id);
    recordUpdate('categories', findById(db, current.id));

    // Keep everything that used the old name in step.
    const table = DEPENDENT[current.kind];
    const affected = db
      .prepare(`SELECT id FROM "${table}" WHERE category = ? AND deleted_at IS NULL`)
      .all(current.name);

    for (const row of affected) {
      db.prepare(`UPDATE "${table}" SET category = ?, updated_at = ? WHERE id = ?`).run(name, now, row.id);
      recordUpdate(table, db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(row.id));
    }

    return res.json({ category: findById(db, current.id), renamed: affected.length });
  });

  api.delete('/categories/:id', (req, res) => {
    const current = findById(db, req.params.id);
    if (!current) return res.status(404).json({ error: 'Category not found.' });

    const table = DEPENDENT[current.kind];
    const inUse = Number(
      db
        .prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE category = ? AND deleted_at IS NULL`)
        .get(current.name)?.n ?? 0,
    );

    if (inUse > 0) {
      return res.status(400).json({
        error: `${inUse} ${LABEL[current.kind]}${inUse === 1 ? '' : 's'} still ${inUse === 1 ? 'uses' : 'use'} "${current.name}".`,
      });
    }

    const now = Date.now();
    db.prepare('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, current.id);
    recordDelete('categories', { ...current, deleted_at: now, updated_at: now });
    return res.json({ ok: true });
  });
}
