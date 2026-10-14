/**
 * The local SQLite database - the admin's source of truth while it is running.
 *
 * One file (`data/pos.db`), no server to install. Reads and writes here are
 * instant and work with the internet unplugged. Changes are mirrored to TiDB by
 * the sync service (added in Step 3).
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TABLE_DEFS } from '../shared/schema.js';
import { sqliteStatements } from '../shared/dialects.js';
import { ensureSqliteColumns } from '../shared/migrate.js';
import { DATA_DIR, PROJECT_ROOT } from './env.js';

export const DB_PATH = path.join(DATA_DIR, 'pos.db');

let database = null;

export function openLocalDatabase() {
  if (database) return database;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');

  for (const statement of sqliteStatements(TABLE_DEFS)) {
    database.exec(statement);
  }
  ensureSqliteColumns(database, TABLE_DEFS);

  return database;
}

export function getDb() {
  if (!database) throw new Error('Local database has not been opened yet.');
  return database;
}

/** Resolve a .env-relative path (like ./certs/ca.pem) against the project root. */
export function projectPath(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value);
}

/** Run a function inside a transaction. */
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
