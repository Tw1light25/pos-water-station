/**
 * Store settings: the single row that drives the landing page, the receipt
 * header and ordering defaults.
 */

import express from 'express';
import { recordUpdate } from '../sync/outbox.js';

/** Columns the admin is allowed to write. */
const WRITABLE = [
  'business_name',
  'logo_url',
  'tagline',
  'description',
  'address',
  'phone',
  'facebook',
  'email',
  'currency',
  'delivery_fee_cents',
  'receipt_footer',
  'store_override',
  'closed_message',
  'timezone',
  'hours_json',
];

/** Columns declared NOT NULL - never let the UI blank them out. */
const NOT_NULL = new Set(['business_name', 'currency', 'store_override', 'timezone']);

function hydrate(row) {
  if (!row) return null;
  const settings = { ...row };
  if (typeof settings.hours_json === 'string' && settings.hours_json) {
    try {
      settings.hours_json = JSON.parse(settings.hours_json);
    } catch {
      settings.hours_json = null;
    }
  }
  return settings;
}

export function currentSettings(db) {
  return db
    .prepare('SELECT * FROM settings WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1')
    .get();
}

export function mountSettingsRoutes(api, db) {
  api.get('/settings', (req, res) => {
    res.json({ settings: hydrate(currentSettings(db)) });
  });

  api.put('/settings', (req, res) => {
    const row = currentSettings(db);
    if (!row) return res.status(404).json({ error: 'No settings row found.' });

    const body = req.body ?? {};
    const updates = [];
    const values = [];

    for (const column of WRITABLE) {
      if (!(column in body)) continue;
      let value = body[column];

      if (column === 'hours_json') {
        value = value == null ? null : JSON.stringify(value);
      } else if (column === 'delivery_fee_cents') {
        value = Math.round(Number(value) || 0);
      } else if (typeof value === 'string') {
        value = value.trim() || null;
      }

      // These columns are NOT NULL: fall back to the current value if cleared.
      if (value === null && NOT_NULL.has(column)) value = row[column];

      updates.push(`"${column}" = ?`);
      values.push(value);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

    updates.push('"updated_at" = ?');
    values.push(Date.now());
    values.push(row.id);

    db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const fresh = currentSettings(db);
    recordUpdate('settings', fresh);
    return res.json({ settings: hydrate(fresh) });
  });
}
