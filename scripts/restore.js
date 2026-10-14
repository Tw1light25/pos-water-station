#!/usr/bin/env node
/**
 * Restore a backup over the local database - the disaster-recovery tool.
 *
 *   npm run restore -- --list
 *   npm run restore -- backups/pos-2026-10-14_135501-20txn.db
 *
 * Stop the admin first (close the "Water Station POS server" window), restore,
 * then start it again.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from '../shared/paths.js';
import { DATA_DIR } from '../admin/env.js';
import { backupConfig, formatBytes, listBackups } from '../admin/backup.js';

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const DB_PATH = path.join(DATA_DIR, 'pos.db');
const SYNC_STATE = path.join(DATA_DIR, 'sync-state.json');

const args = process.argv.slice(2);
const line = (char = '-') => console.log(char.repeat(62));
const cfg = backupConfig();

function fail(message) {
  console.log('');
  console.log(`  ${message}`);
  console.log('');
  process.exit(1);
}

if (args.includes('--list') || args.length === 0) {
  const files = listBackups(cfg.dir);
  line();
  console.log('  Available backups');
  line();
  if (!files.length) {
    console.log(`  None yet in ${cfg.dir}`);
  } else {
    for (const file of files) {
      const when = new Date(file.mtime).toLocaleString('en-PH');
      console.log(`  ${file.name}  (${formatBytes(file.size)}, ${when})`);
    }
  }
  console.log('');
  console.log('  Restore one with:  npm run restore -- backups/<file>');
  console.log('');
  process.exit(0);
}

const target = path.resolve(PROJECT_ROOT, args[0]);

if (!fs.existsSync(target)) fail(`No such file: ${target}`);

const header = fs.readFileSync(target).subarray(0, 16).toString('utf8');
if (!header.startsWith('SQLite format 3')) {
  fail(`${path.basename(target)} does not look like a database backup.`);
}

line();
console.log('  Water Station POS - restore');
line();
console.log(`  From : ${target}`);
console.log(`  To   : ${DB_PATH}`);
console.log('');

// Keep the current database so the restore itself can be undone.
if (fs.existsSync(DB_PATH)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safety = path.join(DATA_DIR, `pos.db.pre-restore-${stamp}`);
  fs.copyFileSync(DB_PATH, safety);
  console.log(`  Borrowed a safety copy: ${path.basename(safety)}`);
}

// The write-ahead log belongs to the database we are about to replace.
for (const suffix of ['-wal', '-shm']) {
  const extra = `${DB_PATH}${suffix}`;
  if (fs.existsSync(extra)) fs.rmSync(extra);
}

fs.copyFileSync(target, DB_PATH);

// Force the next sync to re-read everything from the cloud, so anything newer
// than this snapshot comes back down.
if (fs.existsSync(SYNC_STATE)) {
  fs.rmSync(SYNC_STATE);
  console.log('  Reset the sync marker - the next start re-reads the cloud.');
}

line();
console.log('  Restored.');
line();
console.log('  Start the admin again (Start POS.bat). It will:');
console.log('    - re-read the whole cloud database, and');
console.log('    - keep any cloud row that is newer than this backup.');
console.log('');
