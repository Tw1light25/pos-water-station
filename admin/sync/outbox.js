/**
 * Offline outbox.
 *
 * Every local write also appends one JSON line here. When the connection is
 * available, the sync service (Step 3) reads the file, pushes each line to TiDB
 * and compacts it. Keeping this in place from the start means no write path
 * ever has to be retrofitted later.
 *
 * Format - one JSON object per line:
 *   {"op":"update","table":"settings","row":{...},"at":1760000000000}
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../env.js';

export const OUTBOX_PATH = path.join(DATA_DIR, 'outbox.jsonl');

export function appendChange(op, table, row) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const line = `${JSON.stringify({ op, table, row, at: Date.now() })}\n`;
  fs.appendFileSync(OUTBOX_PATH, line, 'utf8');
}

export function recordInsert(table, row) {
  appendChange('insert', table, row);
}

export function recordUpdate(table, row) {
  appendChange('update', table, row);
}

export function recordDelete(table, row) {
  appendChange('delete', table, row);
}

/** How many changes are still waiting to be pushed. */
export function pendingCount() {
  try {
    if (!fs.existsSync(OUTBOX_PATH)) return 0;
    const content = fs.readFileSync(OUTBOX_PATH, 'utf8');
    if (!content) return 0;
    return content.split('\n').filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

export function readPending() {
  if (!fs.existsSync(OUTBOX_PATH)) return [];
  return parseLines(readRaw());
}

/** Raw file contents (empty string when the file does not exist yet). */
export function readRaw() {
  try {
    if (!fs.existsSync(OUTBOX_PATH)) return '';
    return fs.readFileSync(OUTBOX_PATH, 'utf8');
  } catch {
    return '';
  }
}

export function writeRaw(text) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTBOX_PATH, text, 'utf8');
}

export function parseLines(text) {
  if (!text) return [];
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function serialize(records) {
  if (!records.length) return '';
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
}

export function clearPending() {
  if (fs.existsSync(OUTBOX_PATH)) fs.writeFileSync(OUTBOX_PATH, '', 'utf8');
}
