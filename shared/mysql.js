/**
 * MySQL/TiDB connection helpers shared by the init script and (later) the
 * Netlify functions and the local admin's cloud-sync client.
 *
 * A pool is always created at module scope so warm serverless invocations reuse
 * connections instead of exhausting TiDB's connection limit.
 */

import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { fromProjectRoot } from './paths.js';

function sslConfig(env = process.env) {
  if (String(env.DB_SSL ?? 'true').toLowerCase() === 'false') return undefined;

  let ca;
  if (env.DB_CA) {
    try {
      // Relative paths are resolved from the project folder, not the cwd.
      const caPath = fromProjectRoot(env.DB_CA);
      if (fs.existsSync(caPath)) ca = fs.readFileSync(caPath);
    } catch {
      ca = undefined;
    }
  }
  if (!ca && env.DB_CA_CERT) {
    ca = env.DB_CA_CERT.replace(/\\n/g, '\n');
  }

  return {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: Boolean(ca),
    ...(ca ? { ca } : {}),
  };
}

export function connectionConfig(overrides = {}) {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: sslConfig(),
    connectTimeout: 20_000,
  };

  if (process.env.DB_NAME) config.database = process.env.DB_NAME;

  const merged = { ...config, ...overrides };
  if (!merged.database) delete merged.database;
  return merged;
}

export function createPool(overrides = {}) {
  return mysql.createPool({
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
    ...connectionConfig(overrides),
  });
}

export function createConnection(overrides = {}) {
  return mysql.createConnection(connectionConfig(overrides));
}

/** Human readable target, safe to log (never includes the password). */
export function describeTarget() {
  const host = process.env.DB_HOST || '(unset)';
  const port = process.env.DB_PORT || '4000';
  const user = process.env.DB_USER || '(unset)';
  const db = process.env.DB_NAME || '(unset)';
  return `${user}@${host}:${port}/${db}`;
}
