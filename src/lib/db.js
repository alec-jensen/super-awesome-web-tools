// @ts-nocheck
// MariaDB connection pool helper
// Provides getPool(), query(sql, params), withConnection(fn), and closePool()
// Lazy-initializes a single pool using configuration from config.js

import mariadb from 'mariadb';
import { getConfig } from './config.js';

let pool = null;

function createPool() {
  const cfg = getConfig();
  if (!cfg.database) {
    throw new Error('Database configuration missing (cfg.database)');
  }
  const { host, port, user, password, database } = cfg.database;
  return mariadb.createPool({
    host,
    port,
    user,
    password,
    database,
    // Reasonable defaults; tune later
    connectionLimit: 5,
    compress: true,
    // Allow ~30s acquire timeout
    acquireTimeout: 30_000,
    idleTimeout: 60_000
  });
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function withConnection(fn) {
  const p = getPool();
  let conn;
  try {
    conn = await p.getConnection();
    return await fn(conn);
  } finally {
    if (conn) conn.release();
  }
}

export async function query(sql, params = []) {
  return withConnection(conn => conn.query(sql, params));
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Simple health check returning { ok, error? }
export async function healthCheck() {
  try {
    await query('SELECT 1 as ok');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
