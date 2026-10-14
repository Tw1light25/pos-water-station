/**
 * First-run bootstrap.
 *
 * Pulls the owner account, settings and product catalogue from TiDB the first
 * time the admin starts, so the app has something to log in with and show while
 * offline. Everything after this is kept in step by the sync service (Step 3).
 *
 * If the machine is offline on very first run, this fails softly: the server
 * still starts and the login page explains that one online start is needed.
 */

import { createPool } from '../shared/mysql.js';
import { COLUMNS } from '../shared/tables.js';

const BOOTSTRAP_TABLES = ['users', 'settings', 'products'];

function toSqliteValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

export async function bootstrapIfNeeded(db) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (Number(existing?.n ?? 0) > 0) {
    return { pulled: false, reason: 'already-bootstrapped', tables: [] };
  }

  const pool = createPool({ connectionLimit: 2 });
  const pulled = [];

  try {
    for (const table of BOOTSTRAP_TABLES) {
      const columns = COLUMNS[table];
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      if (!rows.length) continue;

      const statement = db.prepare(
        `INSERT OR REPLACE INTO "${table}" ` +
          `(${columns.map((c) => `"${c}"`).join(', ')}) ` +
          `VALUES (${columns.map(() => '?').join(', ')})`,
      );

      db.exec('BEGIN');
      try {
        for (const row of rows) {
          statement.run(...columns.map((column) => toSqliteValue(row[column])));
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      pulled.push(`${table} (${rows.length})`);
    }

    return { pulled: true, reason: 'first-run', tables: pulled };
  } finally {
    await pool.end().catch(() => {});
  }
}
