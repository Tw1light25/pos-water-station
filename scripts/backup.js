#!/usr/bin/env node
/**
 * Take one backup immediately.
 *
 *   npm run backup             only if something changed since the last backup
 *   npm run backup -- --force  always
 *
 * Also handy as a Windows Task Scheduler job (e.g. once a day, copying the
 * result somewhere off the machine).
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from '../shared/paths.js';
import { openLocalDatabase } from '../admin/db.js';
import {
  backupConfig,
  changeCountSince,
  formatBytes,
  readBackupState,
  runBackup,
} from '../admin/backup.js';

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const FORCE = process.argv.slice(2).includes('--force');
const line = (char = '-') => console.log(char.repeat(62));

const db = openLocalDatabase();
const cfg = backupConfig();
const state = readBackupState();
const changes = changeCountSince(db, state.lastBackupAt);

line();
console.log('  Water Station POS - backup');
line();
console.log(`  Folder : ${cfg.dir}`);

if (!FORCE && changes === 0) {
  console.log('  Result : nothing new since the last backup - no file written.');
  console.log('');
  process.exit(0);
}

if (changes > 0) console.log(`  Changes: ${changes} since the last backup`);

const result = runBackup(db, 'manual');

console.log(`  File   : ${result.name}`);
console.log(`  Size   : ${formatBytes(result.size)}  (${result.method})`);
if (result.removed) console.log(`  Pruned : ${result.removed} old backup(s)`);
console.log(`  Total  : ${result.count} backup(s) kept`);
console.log('');
