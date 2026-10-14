#!/usr/bin/env node
/**
 * Creates the TiDB database, applies the schema, and seeds first-run data.
 *
 *   npm run db:print   print the SQL without connecting (sanity check)
 *   npm run db:init    create + seed the real database
 *
 * Safe to re-run: tables use IF NOT EXISTS and seeding only happens when a
 * table is still empty, so it never duplicates or overwrites your data.
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { TABLE_DEFS } from '../shared/schema.js';
import { PROJECT_ROOT } from '../shared/paths.js';
import { mysqlStatements, renderMySQL } from '../shared/dialects.js';
import { ensureMysqlColumns } from '../shared/migrate.js';
import { createConnection, describeTarget } from '../shared/mysql.js';
import { ulid } from '../shared/ids.js';
import { hashPassword, generatePassword } from '../shared/passwords.js';

// Load .env from the project folder so the command works from any directory.
dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const flags = new Set(process.argv.slice(2));
const PRINT_ONLY = flags.has('--print') || flags.has('--dry-run');
const DB_NAME = process.env.DB_NAME || 'pos-water-station';

const DEFAULT_HOURS = {
  mon: { open: '08:00', close: '18:00', closed: false },
  tue: { open: '08:00', close: '18:00', closed: false },
  wed: { open: '08:00', close: '18:00', closed: false },
  thu: { open: '08:00', close: '18:00', closed: false },
  fri: { open: '08:00', close: '18:00', closed: false },
  sat: { open: '08:00', close: '18:00', closed: false },
  sun: { open: '08:00', close: '18:00', closed: true },
};

const SAMPLE_PRODUCTS = [
  { name: '5-Gallon Refill', unit: 'container', category: 'Refill', price_cents: 2500 },
  { name: '5-Gallon New Container', unit: 'container', category: 'Container', price_cents: 18000 },
  { name: '1-Gallon Refill', unit: 'container', category: 'Refill', price_cents: 1000 },
  { name: 'Purified Water 500ml', unit: 'bottle', category: 'Bottled', price_cents: 1500 },
  { name: 'Purified Water 1L', unit: 'bottle', category: 'Bottled', price_cents: 2500 },
];

const line = (char = '-') => console.log(char.repeat(62));
const section = (title) => {
  console.log('');
  line();
  console.log(title);
  line();
};

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    section('Configuration problem');
    console.error(`Missing required value(s) in .env: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your TiDB connection.');
    process.exit(1);
  }
}

function friendlyError(error) {
  const code = error?.code || '';
  const hints = {
    ER_ACCESS_DENIED_ERROR: 'Wrong DB_USER or DB_PASS. Re-copy them from the TiDB Connect dialog.',
    ER_DBACCESS_DENIED_ERROR: 'This user cannot access the database. Check the database name.',
    ECONNREFUSED: 'Connection refused. Check DB_HOST/DB_PORT.',
    ETIMEDOUT: 'Timed out. Most likely the IP allowlist: add 0.0.0.0/0 in TiDB > Settings > Networking.',
    ENOTFOUND: 'Host not found. Check DB_HOST for typos.',
    CERT_HAS_EXPIRED: 'TLS certificate problem. Re-download ca.pem from the TiDB console.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'TLS hostname mismatch. Make sure DB_HOST matches the cert.',
  };
  const hint = hints[code];
  if (hint) console.error(`\nHint: ${hint}`);
}

async function ensureDatabase() {
  const admin = await createConnection({ database: undefined });
  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` ` +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    );
  } finally {
    await admin.end();
  }
}

async function applySchema(db) {
  const statements = mysqlStatements(TABLE_DEFS);
  for (const statement of statements) {
    await db.query(statement);
  }
  return statements.length;
}

async function firstRow(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows[0] ?? null;
}

async function seedSettings(db) {
  const existing = await firstRow(db, 'SELECT id FROM settings WHERE deleted_at IS NULL LIMIT 1');
  if (existing) return { created: false };

  const now = Date.now();
  const business = process.env.BUSINESS_NAME || 'Water Station';
  await db.query(
    `INSERT INTO settings
       (id, business_name, logo_url, currency, delivery_fee_cents, store_override, timezone, hours_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ulid(),
      business,
      '/assets/img/logo.jpg',
      'PHP',
      0,
      'auto',
      'Asia/Manila',
      JSON.stringify(DEFAULT_HOURS),
      now,
      now,
    ],
  );
  return { created: true, business };
}

async function seedOwner(db) {
  const existing = await firstRow(db, 'SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1');
  if (existing) return { created: false };

  const username = (process.env.OWNER_USERNAME || 'owner').trim() || 'owner';
  let password = (process.env.OWNER_PASSWORD || '').trim();
  let generated = false;
  if (!password) {
    password = generatePassword();
    generated = true;
  }

  const now = Date.now();
  await db.query(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ulid(), username, hashPassword(password), 'Owner', 'owner', now, now],
  );
  return { created: true, username, password, generated };
}

async function seedProducts(db) {
  if (String(process.env.SEED_PRODUCTS ?? 'true').toLowerCase() === 'false') {
    return { created: false, skipped: true };
  }
  const existing = await firstRow(db, 'SELECT id FROM products WHERE deleted_at IS NULL LIMIT 1');
  if (existing) return { created: false };

  const now = Date.now();
  for (const product of SAMPLE_PRODUCTS) {
    await db.query(
      `INSERT INTO products (id, name, unit, category, price_cents, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ulid(), product.name, product.unit, product.category, product.price_cents, 1, now, now],
    );
  }
  return { created: true, count: SAMPLE_PRODUCTS.length };
}

async function printSummary(db) {
  section('Summary');
  for (const table of TABLE_DEFS) {
    const row = await firstRow(db, `SELECT COUNT(*) AS n FROM \`${table.name}\``);
    console.log(`  ${table.name.padEnd(18)} ${String(row?.n ?? 0).padStart(6)} row(s)`);
  }
}

async function main() {
  if (PRINT_ONLY) {
    process.stdout.write(renderMySQL(TABLE_DEFS) + '\n');
    return;
  }

  requireEnv(['DB_HOST', 'DB_USER', 'DB_PASS']);

  section('Point of Sale - database setup');
  console.log(`  Target : ${describeTarget()}`);
  console.log(`  TLS    : ${process.env.DB_CA || process.env.DB_CA_CERT ? 'enabled (CA cert)' : 'enabled (unverified)'}`);

  await ensureDatabase();
  console.log(`\n  Database \`${DB_NAME}\` is ready.`);

  const db = await createConnection();
  try {
    const tableCount = await applySchema(db);
    console.log(`  Schema applied: ${tableCount} table(s).`);

    const addedColumns = await ensureMysqlColumns(db, TABLE_DEFS);
    if (addedColumns.length) {
      console.log(`  Migrations: added ${addedColumns.join(', ')}`);
    }

    const settings = await seedSettings(db);
    const owner = await seedOwner(db);
    const products = await seedProducts(db);

    section('Seeding');
    console.log(
      settings.created
        ? `  Settings        created (${settings.business})`
        : '  Settings        already present, left untouched',
    );
    console.log(
      products.created
        ? `  Products        ${products.count} sample product(s) inserted`
        : products.skipped
          ? '  Products        seeding skipped (SEED_PRODUCTS=false)'
          : '  Products        already present, left untouched',
    );

    if (owner.created) {
      console.log(`  Owner account   ${owner.username}`);
      if (owner.generated) {
        line();
        console.log('  OWNER PASSWORD (save this now, it will not be shown again):');
        console.log(`      ${owner.password}`);
        line();
      } else {
        console.log('  Owner account   password taken from .env (OWNER_PASSWORD)');
      }
    } else {
      console.log('  Owner account   already exists, left untouched');
    }

    await printSummary(db);

    section('Done');
    console.log('  Your cloud database is ready.');
    console.log('  Next: Step 2 builds the local admin that talks to it.');
    console.log('');
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  section('Setup failed');
  console.error(`  ${error?.message || error}`);
  friendlyError(error);
  console.error('');
  process.exit(1);
});
