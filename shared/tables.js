/**
 * Sync registry.
 *
 * Describes, per table, everything the offline sync engine needs to know so it
 * can move rows between the local SQLite database and TiDB without hand-written
 * per-table code. Derived from the same `schema.js` the DDL comes from, so it
 * stays in step automatically.
 */

import { TABLE_DEFS, TABLE_BY_NAME as SCHEMA_BY_NAME, TABLE_NAMES } from './schema.js';

export const TABLES = TABLE_NAMES;
export const TABLE_BY_NAME = SCHEMA_BY_NAME;

export const PRIMARY_KEY = 'id';
export const UPDATED_AT = 'updated_at';
export const DELETED_AT = 'deleted_at';

/** table name -> ordered column names */
export const COLUMNS = Object.fromEntries(
  TABLE_DEFS.map((table) => [table.name, table.columns.map((c) => c.name)]),
);

/**
 * Rows here are only ever inserted, never edited. Union-merging them is always
 * correct, so the sync engine can replay them freely without conflict checks.
 */
export const APPEND_ONLY = new Set(['inventory_logs', 'order_items', 'payments']);

/**
 * Tables whose rows may be created by the public (customer) side. The admin
 * pulls these down; everything not listed is owned by the admin and pushed up.
 */
export const CLOUD_CREATED = new Set(['orders', 'order_items']);

/** Columns that exist on both sides and are safe to compare for LWW. */
export function isSyncable(table) {
  return TABLES.includes(table);
}

export function columnsOf(table) {
  return COLUMNS[table] ?? [];
}

/** Build a parameter placeholders string: "(?, ?, ?)". */
export function placeholders(count, dialect = 'mysql') {
  void dialect;
  return `(${Array.from({ length: count }, () => '?').join(', ')})`;
}
