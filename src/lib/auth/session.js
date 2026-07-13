// @ts-nocheck
// Session management utilities: create, validate, and destroy sessions via cookies.

import crypto from 'node:crypto';
import { query } from '../db.js';
import { ensureAuthTables } from './tables.js';

const SESSION_COOKIE = 'sat_session';
const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cookieOptions(expiresAt) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  };
}

export async function createSessionCookie(cookies, userId) {
  await ensureAuthTables();
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, tokenHash, expiresAt]);
  cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return tokenHash;
}

export async function rotateSessionOnLogin(cookies, userId) {
  await ensureAuthTables();
  // Delete all existing sessions for this user (prevents session fixation)
  await query('DELETE FROM sessions WHERE user_id = ?', [userId]);
  // Create new session token
  return await createSessionCookie(cookies, userId);
}

export async function destroySessionCookie(cookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await ensureAuthTables();
  const isProd = process.env.NODE_ENV === 'production';
  cookies.delete(SESSION_COOKIE, {
    path: '/',
    secure: isProd,
    sameSite: 'strict',
    httpOnly: true,
  });
  const tokenHash = sha256(token);
  await query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

export async function getSessionUser(cookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureAuthTables();
  const tokenHash = sha256(token);
  const rows = await query(
    `SELECT u.id, u.email, u.role, u.email_verified, u.created_at, u.updated_at, u.last_login_at, s.expires_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = ?`,
    [tokenHash]
  );
  if (!rows || rows.length === 0) {
    return null;
  }
  const session = rows[0];
  const expires = session.expires_at instanceof Date ? session.expires_at : new Date(session.expires_at);
  if (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now()) {
    await query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return null;
  }
  return {
    id: session.id,
    email: session.email,
    role: session.role,
    emailVerified: session.email_verified,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    lastLoginAt: session.last_login_at,
  };
}

export function requireUser(user) {
  if (!user) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  return user;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
