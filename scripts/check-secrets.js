#!/usr/bin/env node
/**
 * Pre-push secret check.
 *
 * Catches the things that must never reach a Git host (and therefore Netlify):
 *   - .env files, TLS certificates, the data/ and hide/ folders being tracked
 *   - PEM markers in source files (Netlify's smart secret scanning blocks these)
 *   - the real DB_PASS value leaking into a committed file
 *
 *   npm run check
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from '../shared/paths.js';

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

let failures = 0;
const pass = (msg) => console.log(`  [ OK ]  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  [FAIL]  ${msg}`);
};

const line = (char = '-') => console.log(char.repeat(62));

/** Files git would push. Null when not a repository. */
function trackedFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

/** Fallback for non-git folders: walk the tree, skipping generated folders. */
function walkFiles(dir, base = '') {
  const skip = new Set(['node_modules', '.git', 'data', 'hide']);
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walkFiles(path.join(dir, entry.name), relative));
    else found.push(relative);
  }
  return found;
}

function readText(relative) {
  try {
    const buffer = fs.readFileSync(path.join(PROJECT_ROOT, relative));
    if (buffer.subarray(0, 8000).includes(0)) return null; // binary
    return buffer.toString('utf8');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ checks */

const files = trackedFiles();
const inGit = files !== null;

console.log('');
line();
console.log('  Water Station POS - secret check');
line();
console.log(
  inGit
    ? `  Scanning ${files.length} file(s) tracked by git.`
    : '  Not a git repository - scanning the folder instead.',
);

// 1. things that must not be tracked at all
console.log('\n1. Files that must never be pushed');

const FORBIDDEN = [
  [/\.pem$/i, 'certificate (.pem)'],
  [/^data\//, 'local database folder'],
  [/^hide\//, 'credentials folder'],
  [/^node_modules\//, 'installed dependencies'],
  [/^\.env$/, '.env file'],
  [/^\.env\.(local|development|production)$/, 'environment file'],
];

const scanList = inGit ? files : walkFiles(PROJECT_ROOT);
const offending = [];

for (const relative of scanList) {
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(relative)) offending.push(`${relative}  (${label})`);
  }
}

if (offending.length) {
  for (const item of offending) fail(item);
} else {
  pass('No .env, certificates, data/ or hide/ are included');
}

// 2. PEM markers in text files (what tripped Netlify)
console.log('\n2. PEM markers in source files');

// Built at runtime: this file must not contain the marker it searches for,
// otherwise it trips both this check and Netlify's scanner.
const PEM_MARKER = '-'.repeat(5) + 'BEGIN';

const pemFiles = [];
for (const relative of scanList) {
  if (/\.(png|jpg|jpeg|gif|ico|woff2?|ttf|pdf|zip)$/i.test(relative)) continue;
  const text = readText(relative);
  if (text && text.includes(PEM_MARKER)) pemFiles.push(relative);
}

if (pemFiles.length) {
  for (const relative of pemFiles) fail(`${relative} contains a certificate marker`);
  console.log('         Netlify\'s secret scanning blocks builds that contain these.');
} else {
  pass('No certificate markers in any file');
}

// 3. the real database password must not appear anywhere
console.log('\n3. Credential values');

const password = process.env.DB_PASS;
if (!password || password.length < 4) {
  pass('DB_PASS is not set locally - nothing to compare');
} else {
  const leaks = [];
  for (const relative of scanList) {
    if (relative === '.env') continue;
    const text = readText(relative);
    if (text && text.includes(password)) leaks.push(relative);
  }
  if (leaks.length) {
    for (const relative of leaks) fail(`${relative} contains your database password`);
  } else {
    pass('Your database password appears nowhere outside .env');
  }
}

/* ------------------------------------------------------------------ result */

console.log('');
line();
if (failures) {
  console.log(`  ${failures} problem(s) found - do NOT push until they are fixed.`);
  line();
  console.log('');
  process.exit(1);
}
console.log('  All clear - safe to commit and push.');
line();
console.log('');
