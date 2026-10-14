/**
 * Lightweight migrations.
 *
 * CREATE TABLE IF NOT EXISTS never changes an existing table, so when a column
 * is added to `schema.js` we also need to ALTER existing databases. These
 * helpers add any missing columns to TiDB and to the local SQLite file, which
 * keeps both sides in step as the schema grows.
 */

import { columnDefinition } from './dialects.js';

function missingColumns(existingNames, table) {
  return table.columns.filter((column) => !existingNames.has(column.name));
}

/** Add missing columns to the local SQLite database. Returns "table.column" ids. */
export function ensureSqliteColumns(db, tables) {
  const added = [];
  for (const table of tables) {
    const info = db.prepare(`PRAGMA table_info("${table.name}")`).all();
    if (!info.length) continue; // table does not exist yet; CREATE handles it
    const existing = new Set(info.map((row) => row.name));
    for (const column of missingColumns(existing, table)) {
      db.exec(`ALTER TABLE "${table.name}" ADD COLUMN ${columnDefinition(column, 'sqlite')}`);
      added.push(`${table.name}.${column.name}`);
    }
  }
  return added;
}

/** Add missing columns to TiDB. Returns "table.column" ids. */
export async function ensureMysqlColumns(db, tables) {
  const [rows] = await db.query(
    'SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name ' +
      'FROM information_schema.columns WHERE table_schema = DATABASE()',
  );

  const byTable = new Map();
  for (const row of rows) {
    const name = row.table_name;
    if (!byTable.has(name)) byTable.set(name, new Set());
    byTable.get(name).add(row.column_name);
  }

  const added = [];
  for (const table of tables) {
    const existing = byTable.get(table.name);
    if (!existing) continue; // table does not exist yet; CREATE handles it
    for (const column of missingColumns(existing, table)) {
      await db.query(`ALTER TABLE \`${table.name}\` ADD COLUMN ${columnDefinition(column, 'mysql')}`);
      added.push(`${table.name}.${column.name}`);
    }
  }
  return added;
}
