// @ts-nocheck
// User repository helpers

import { query } from '../db.js';
import { ensureAuthTables } from './tables.js';
import { isEmailEnabled } from '../email.js';

export async function findUserByEmail(email) {
  await ensureAuthTables();
  const rows = await query('SELECT id, email, password_hash, role, email_verified, created_at, updated_at, last_login_at FROM users WHERE email = ?', [email]);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function getUserCount() {
  await ensureAuthTables();
  const rows = await query('SELECT COUNT(*) as count FROM users');
  if (!rows || rows.length === 0) {
    return 0;
  }
  // Handle different ways drivers return count
  const count = rows[0].count || rows[0]['COUNT(*)'] || 0;
  // Ensure it's a number
  return typeof count === 'number' ? count : parseInt(count, 10) || 0;
}

export async function createUser(email, passwordHash, role = 'user') {
  await ensureAuthTables();
  
  // Enable email 2FA by default if SMTP is configured
  const emailTwoFactorEnabled = isEmailEnabled();
  
  const result = await query(
    'INSERT INTO users (email, password_hash, role, email_2fa_enabled) VALUES (?, ?, ?, ?)', 
    [email, passwordHash, role, emailTwoFactorEnabled]
  );
  return result.insertId;
}

export async function recordLogin(userId) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
}

export async function getUserById(id) {
  await ensureAuthTables();
  const rows = await query('SELECT id, email, role, email_verified, created_at, updated_at, last_login_at FROM users WHERE id = ?', [id]);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function updateUserEmail(userId, newEmail) {
  await ensureAuthTables();
  await query('UPDATE users SET email = ?, email_verified = FALSE, updated_at = NOW() WHERE id = ?', [newEmail, userId]);
}

export async function updateUserPassword(userId, newPasswordHash) {
  await ensureAuthTables();
  await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [newPasswordHash, userId]);
}

export async function deleteUser(userId) {
  await ensureAuthTables();
  // Sessions will be deleted automatically due to CASCADE
  await query('DELETE FROM users WHERE id = ?', [userId]);
}
