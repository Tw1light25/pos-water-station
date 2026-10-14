/**
 * Offline sync service.
 *
 * Runs inside the admin server. Every cycle it:
 *
 *   1. PUSHES  - drains data/outbox.jsonl into TiDB (upsert by ULID).
 *   2. PULLS   - copies rows changed in TiDB since the last cycle into the
 *                local SQLite database (so customer orders appear locally).
 *
 * Why it is safe:
 *  - ULID ids mean two devices can never create the same row.
 *  - Upserts mean re-sending a record is harmless (idempotent).
 *  - Mutable rows resolve last-write-wins on `updated_at`.
 *  - Append-only tables (stock moves, order items, payments) just merge.
 *
 * The outbox file is compacted carefully: lines appended *while* a push is in
 * flight are preserved, and lines that failed stay queued for the next cycle.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../env.js';
import { TABLES, COLUMNS } from '../../shared/tables.js';
import { TABLE_DEFS } from '../../shared/schema.js';
import { ensureMysqlColumns } from '../../shared/migrate.js';
import { createPool } from '../../shared/mysql.js';
import * as outbox from './outbox.js';

const DEFAULT_INTERVAL_MS = 15_000;
const PULL_BATCH = 500;
const STATE_PATH = path.join(DATA_DIR, 'sync-state.json');

/* ------------------------------------------------------------------ helpers */

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function toMysqlValue(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function toSqliteValue(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

const mysqlUpserts = new Map();
function upsertMysql(table, columns) {
  const key = `${table}:${columns.join(',')}`;
  if (mysqlUpserts.has(key)) return mysqlUpserts.get(key);

  const list = columns.map((column) => `\`${column}\``).join(', ');
  const params = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(', ');

  const sql = `INSERT INTO \`${table}\` (${list}) VALUES (${params}) ON DUPLICATE KEY UPDATE ${updates}`;
  mysqlUpserts.set(key, sql);
  return sql;
}

const sqliteUpserts = new Map();
function upsertSqlite(table, columns) {
  const key = `${table}:${columns.join(',')}`;
  if (sqliteUpserts.has(key)) return sqliteUpserts.get(key);

  const list = columns.map((column) => `"${column}"`).join(', ');
  const params = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = excluded."${column}"`)
    .join(', ');

  const sql =
    `INSERT INTO "${table}" (${list}) VALUES (${params}) ` +
    `ON CONFLICT("id") DO UPDATE SET ${updates}`;
  sqliteUpserts.set(key, sql);
  return sql;
}

/* ------------------------------------------------------------------- service */

export function createSyncService(db, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const status = {
    online: true,
    running: false,
    pending: outbox.pendingCount(),
    lastSyncAt: null,
    lastPushed: 0,
    lastPulled: 0,
    lastError: null,
    schemaSyncAt: null,
    intervalMs,
  };

  let pool = null;
  let timer = null;
  let inFlight = null;
  let stopped = false;

  function getPool() {
    if (!pool) pool = createPool({ connectionLimit: 2 });
    return pool;
  }

  async function pushRecord(connection, record) {
    const { table, row } = record;
    if (!TABLES.includes(table)) throw new Error(`Unknown table "${table}"`);
    if (!row || !row.id) throw new Error('Outbox record without a row id');

    const columns = COLUMNS[table].filter((column) => column in row);
    if (!columns.length) throw new Error(`No known columns for "${table}"`);

    await connection.query(
      upsertMysql(table, columns),
      columns.map((column) => toMysqlValue(row[column])),
    );
  }

  async function pushOnce() {
    const raw = outbox.readRaw();
    const records = outbox.parseLines(raw);
    if (!records.length) return 0;

    const connection = await getPool().getConnection();
    const failed = [];
    let pushed = 0;

    try {
      for (const record of records) {
        try {
          await pushRecord(connection, record);
          pushed += 1;
        } catch (error) {
          error.record = record;
          failed.push(record);
        }
      }
    } finally {
      connection.release();
    }

    // Preserve anything appended while we were pushing.
    const current = outbox.readRaw();
    const appended = current.startsWith(raw) ? current.slice(raw.length) : '';
    outbox.writeRaw(outbox.serialize(failed) + appended);

    return pushed;
  }

  function applyPulledRow(table, row) {
    const columns = COLUMNS[table].filter((column) => column in row);
    const local = db.prepare(`SELECT updated_at FROM "${table}" WHERE id = ?`).get(row.id);

    // Last-write-wins: never clobber a newer local row.
    if (local && Number(local.updated_at) >= Number(row.updated_at)) return false;

    db.prepare(upsertSqlite(table, columns)).run(
      ...columns.map((column) => toSqliteValue(row[column])),
    );
    return true;
  }

  async function pullOnce(state) {
    const pullState = { ...(state.pull ?? {}) };
    let pulled = 0;

    const connection = await getPool().getConnection();
    try {
      for (const table of TABLES) {
        const since = Number(pullState[table] ?? 0);
        const [rows] = await connection.query(
          `SELECT * FROM \`${table}\` WHERE updated_at > ? ORDER BY updated_at ASC LIMIT ${PULL_BATCH}`,
          [since],
        );
        if (!rows.length) continue;

        let maxUpdated = since;
        for (const row of rows) {
          maxUpdated = Math.max(maxUpdated, Number(row.updated_at) || 0);
          if (applyPulledRow(table, row)) pulled += 1;
        }
        // Guard against a full batch that shares one timestamp.
        if (rows.length >= PULL_BATCH && maxUpdated <= since) maxUpdated = since + 1;
        pullState[table] = maxUpdated;
      }
    } finally {
      connection.release();
    }

    state.pull = pullState;
    return pulled;
  }

  async function syncSchemaOnce() {
    if (status.schemaSyncAt) return;
    const connection = await getPool().getConnection();
    try {
      await ensureMysqlColumns(connection, TABLE_DEFS);
      status.schemaSyncAt = Date.now();
    } finally {
      connection.release();
    }
  }

  async function doRun() {
    // Schema first: a new local column must exist in TiDB before it is pushed.
    try {
      await syncSchemaOnce();
    } catch (error) {
      status.lastError = `schema: ${error.message}`;
    }

    const state = readState();
    const pushed = await pushOnce();
    const pulled = await pullOnce(state);
    writeState(state);

    return { pushed, pulled };
  }

  function runOnce() {
    if (inFlight) return inFlight;
    status.running = true;

    inFlight = doRun()
      .then(({ pushed, pulled }) => {
        status.online = true;
        status.lastError = null;
        status.lastPushed = pushed;
        status.lastPulled = pulled;
        status.lastSyncAt = Date.now();
        return { ok: true, pushed, pulled };
      })
      .catch((error) => {
        status.online = false;
        status.lastError = error.message;
        return { ok: false, error: error.message };
      })
      .finally(() => {
        status.running = false;
        status.pending = outbox.pendingCount();
        inFlight = null;
      });

    return inFlight;
  }

  function start() {
    if (timer) return;
    stopped = false;
    runOnce();
    timer = setInterval(() => {
      if (!stopped) runOnce();
    }, intervalMs);
  }

  async function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
    if (inFlight) await inFlight.catch(() => {});
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }
  }

  function getStatus() {
    return { ...status, pending: outbox.pendingCount() };
  }

  return { start, stop, syncNow: runOnce, getStatus };
}
