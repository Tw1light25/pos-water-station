/**
 * Automatic backups.
 *
 * Takes a consistent, compact snapshot of the local database:
 *
 *   - after every 20 transactions (orders, payments, expenses, customers)
 *   - every 30 minutes, if anything changed at all
 *   - when the admin starts, if the previous session ended without a backup
 *   - when the admin shuts down cleanly
 *
 * A quiet shop never writes a backup - if nothing changed, nothing happens.
 *
 * Snapshots use SQLite's `VACUUM INTO`, which produces a complete, compact,
 * single-file copy that is safe to take while the shop is serving customers.
 * The state file lives OUTSIDE the database on purpose: it has to survive the
 * very corruption we are protecting against.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PROJECT_ROOT } from './env.js';
import { fromProjectRoot } from '../shared/paths.js';

const STATE_PATH = path.join(DATA_DIR, 'backup-state.json');
const DB_PATH = path.join(DATA_DIR, 'pos.db');

/** A human action: these drive the "every N transactions" trigger. */
const TRANSACTION_TABLES = ['orders', 'payments', 'expenses', 'customers'];

/** Every business table: these answer "did anything change at all?". */
const BUSINESS_TABLES = [
  'orders',
  'order_items',
  'payments',
  'customers',
  'expenses',
  'inventory_logs',
  'products',
  'settings',
];

export function backupConfig() {
  const dir = process.env.BACKUP_DIR
    ? fromProjectRoot(process.env.BACKUP_DIR)
    : path.join(PROJECT_ROOT, 'backups');

  return {
    enabled: String(process.env.BACKUP_ENABLED ?? 'true').toLowerCase() !== 'false',
    everyTransactions: Math.max(1, Number(process.env.BACKUP_EVERY_TRANSACTIONS) || 20),
    intervalMinutes: Math.max(1, Number(process.env.BACKUP_INTERVAL_MINUTES) || 30),
    keep: Math.max(1, Number(process.env.BACKUP_KEEP) || 30),
    checkSeconds: Math.max(5, Number(process.env.BACKUP_CHECK_SECONDS) || 10),
    dir,
  };
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function readBackupState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return {
      lastBackupAt: Number(state.lastBackupAt) || 0,
      count: Number(state.count) || 0,
      lastFile: state.lastFile ?? null,
      lastReason: state.lastReason ?? null,
    };
  } catch {
    return { lastBackupAt: 0, count: 0, lastFile: null, lastReason: null };
  }
}

function writeBackupState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/** Backup files, newest first. */
export function listBackups(dir = backupConfig().dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => /^pos-.*\.db$/.test(name))
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return { name, path: full, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

function countSince(db, tables, since) {
  let total = 0;
  for (const table of tables) {
    try {
      // `>=` on purpose: a write landing in the same millisecond as a backup
      // would otherwise be invisible to every future backup. Counting it twice
      // at worst causes one extra snapshot, which is the safe direction.
      const row = db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE updated_at >= ?`).get(since);
      total += Number(row?.n ?? 0);
    } catch {
      // A missing table should never stop a backup from happening.
    }
  }
  return total;
}

export function transactionCountSince(db, since) {
  return countSince(db, TRANSACTION_TABLES, since);
}

export function changeCountSince(db, since) {
  return countSince(db, BUSINESS_TABLES, since);
}

/** Delete everything past the newest `keep` files. Returns how many went. */
function prune(dir, keep) {
  const files = listBackups(dir);
  const doomed = files.slice(keep);
  let removed = 0;
  for (const file of doomed) {
    try {
      fs.unlinkSync(file.path);
      removed += 1;
    } catch {
      /* leave it and try again next time */
    }
  }
  return removed;
}

/**
 * Write one backup. `reason` becomes part of the file name so it is obvious
 * later why a snapshot exists.
 */
export function runBackup(db, reason = 'manual', { keep } = {}) {
  const cfg = backupConfig();
  const keepCount = Number.isFinite(keep) ? keep : cfg.keep;

  fs.mkdirSync(cfg.dir, { recursive: true });

  let target = path.join(cfg.dir, `pos-${timestamp()}-${reason}.db`);
  let attempt = 1;
  while (fs.existsSync(target)) {
    attempt += 1;
    target = path.join(cfg.dir, `pos-${timestamp()}-${reason}-${attempt}.db`);
  }

  let method = 'vacuum';
  try {
    db.prepare('VACUUM INTO ?').run(target);
  } catch {
    // Fallback: flush the write-ahead log, then take a plain copy.
    method = 'copy';
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      /* not fatal */
    }
    fs.copyFileSync(DB_PATH, target);
  }

  const stat = fs.statSync(target);
  const previous = readBackupState();
  const state = {
    lastBackupAt: Date.now(),
    count: previous.count + 1,
    lastFile: target,
    lastReason: reason,
  };
  writeBackupState(state);

  const removed = prune(cfg.dir, keepCount);

  return { ...state, name: path.basename(target), path: target, size: stat.size, method, removed };
}

/* ------------------------------------------------------------------ service */

export function createBackupService(db, { logger = console } = {}) {
  const status = { lastError: null, lastRunAt: null, running: false };
  let timer = null;

  function safeRun(reason) {
    if (status.running) return null;
    status.running = true;
    try {
      const result = runBackup(db, reason);
      status.lastError = null;
      status.lastRunAt = result.lastBackupAt;
      logger.log(
        `  backup   ${result.name} (${formatBytes(result.size)}${result.removed ? `, removed ${result.removed} old` : ''})`,
      );
      return result;
    } catch (error) {
      status.lastError = error.message;
      logger.error(`  backup   FAILED (${reason}): ${error.message}`);
      return null;
    } finally {
      status.running = false;
    }
  }

  /** Back up only when there is something new. */
  function backupIfChanged(reason) {
    const state = readBackupState();
    if (changeCountSince(db, state.lastBackupAt) === 0) return null;
    return safeRun(reason);
  }

  function tick() {
    const cfg = backupConfig();
    if (!cfg.enabled) return;

    const state = readBackupState();
    const transactions = transactionCountSince(db, state.lastBackupAt);
    const changes = transactions > 0 ? transactions : changeCountSince(db, state.lastBackupAt);

    if (changes === 0) return; // nothing new - no backup

    if (transactions >= cfg.everyTransactions) {
      safeRun('20txn');
      return;
    }

    if (Date.now() - state.lastBackupAt >= cfg.intervalMinutes * 60_000) {
      safeRun('scheduled');
    }
  }

  function start() {
    const cfg = backupConfig();
    if (!cfg.enabled) {
      logger.log('  backup   disabled (BACKUP_ENABLED=false)');
      return;
    }
    logger.log(
      `  backup   every ${cfg.everyTransactions} transactions, or ${cfg.intervalMinutes} min -> ${cfg.dir}`,
    );
    // Catch up if the last session ended without a backup (hard shutdown, crash).
    const caught = backupIfChanged('startup');
    if (!caught) logger.log('  backup   nothing new since the last backup');

    timer = setInterval(tick, cfg.checkSeconds * 1000);
    if (timer.unref) timer.unref();
  }

  /** Runs a final backup when the admin is stopped cleanly. */
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    return backupIfChanged('shutdown');
  }

  function getStatus() {
    const cfg = backupConfig();
    const state = readBackupState();
    const files = listBackups(cfg.dir);

    return {
      enabled: cfg.enabled,
      everyTransactions: cfg.everyTransactions,
      intervalMinutes: cfg.intervalMinutes,
      keep: cfg.keep,
      directory: cfg.dir,
      lastBackupAt: state.lastBackupAt || null,
      lastReason: state.lastReason,
      count: state.count,
      lastFile: state.lastFile,
      lastError: status.lastError,
      transactionsSince: transactionCountSince(db, state.lastBackupAt),
      changesSince: changeCountSince(db, state.lastBackupAt),
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      recent: files.slice(0, 5).map((file) => ({ name: file.name, size: file.size, at: file.mtime })),
    };
  }

  /** Force a backup, even if nothing changed (the "Back up now" button). */
  function runNow() {
    return safeRun('manual');
  }

  return { start, stop, tick, getStatus, runNow, backupIfChanged };
}
