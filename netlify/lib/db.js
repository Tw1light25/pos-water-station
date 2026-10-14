/**
 * TiDB connection for the Netlify functions.
 *
 * The pool is created at module scope so warm invocations reuse it instead of
 * opening a new connection on every request. `connectionLimit: 1` keeps us well
 * inside TiDB's connection allowance on serverless.
 */

import mysql from 'mysql2/promise';

let pool = null;

function sslConfig() {
  if (String(process.env.DB_SSL ?? 'true').toLowerCase() === 'false') return undefined;

  const ca = process.env.DB_CA_CERT ? process.env.DB_CA_CERT.replace(/\\n/g, '\n') : null;
  if (ca) return { minVersion: 'TLSv1.2', ca, rejectUnauthorized: true };
  return { minVersion: 'TLSv1.2', rejectUnauthorized: false };
}

export function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: sslConfig(),
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 5000,
    waitForConnections: true,
    enableKeepAlive: true,
  });

  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** mysql2 may hand back JSON columns already parsed, or as a string. */
export function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
