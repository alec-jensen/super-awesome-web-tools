// @ts-nocheck
// Email verification and password reset token management

import crypto from 'crypto';
import { query } from '../db.js';
import { ensureAuthTables } from './tables.js';

/**
 * Generate a cryptographically secure random token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an email verification token for a user
 * @param {number} userId - User ID
 * @returns {string} - Verification token
 */
export async function createEmailVerificationToken(userId) {
  await ensureAuthTables();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    'UPDATE users SET email_verification_token = ?, email_verification_expires_at = ? WHERE id = ?',
    [token, expiresAt, userId]
  );

  return token;
}

/**
 * Verify an email verification token and mark email as verified
 * @param {string} token - Verification token
 * @returns {Object} - { ok: boolean, userId?: number, error?: string }
 */
export async function verifyEmailToken(token) {
  await ensureAuthTables();

  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Invalid token' };
  }

  const rows = await query(
    'SELECT id, email_verified FROM users WHERE email_verification_token = ? AND email_verification_expires_at > NOW()',
    [token]
  );

  if (!rows || rows.length === 0) {
    return { ok: false, error: 'Invalid or expired token' };
  }

  const user = rows[0];

  if (user.email_verified) {
    return { ok: false, error: 'Email already verified' };
  }

  await query(
    'UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = ?',
    [user.id]
  );

  return { ok: true, userId: user.id };
}

/**
 * Create a password reset token for a user
 * @param {string} email - User email address
 * @returns {Object} - { ok: boolean, token?: string, error?: string }
 */
export async function createPasswordResetToken(email) {
  await ensureAuthTables();

  const rows = await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);

  if (!rows || rows.length === 0) {
    // Don't reveal whether the email exists
    return { ok: true, token: null };
  }

  const userId = rows[0].id;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    'UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?',
    [token, expiresAt, userId]
  );

  return { ok: true, token };
}

/**
 * Verify a password reset token
 * @param {string} token - Reset token
 * @returns {Object} - { ok: boolean, userId?: number, error?: string }
 */
export async function verifyPasswordResetToken(token) {
  await ensureAuthTables();

  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Invalid token' };
  }

  const rows = await query(
    'SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires_at > NOW()',
    [token]
  );

  if (!rows || rows.length === 0) {
    return { ok: false, error: 'Invalid or expired token' };
  }

  return { ok: true, userId: rows[0].id };
}

/**
 * Reset a user's password using a valid reset token
 * @param {string} token - Reset token
 * @param {string} newPasswordHash - New password hash
 * @returns {Object} - { ok: boolean, error?: string }
 */
export async function resetPasswordWithToken(token, newPasswordHash) {
  const verification = await verifyPasswordResetToken(token);

  if (!verification.ok) {
    return verification;
  }

  await query(
    'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?',
    [newPasswordHash, verification.userId]
  );

  return { ok: true };
}

/**
 * Check if a user's email is verified
 * @param {number} userId - User ID
 * @returns {boolean}
 */
export async function isEmailVerified(userId) {
  await ensureAuthTables();

  const rows = await query('SELECT email_verified FROM users WHERE id = ?', [userId]);

  if (!rows || rows.length === 0) {
    return false;
  }

  return Boolean(rows[0].email_verified);
}

/**
 * Resend verification email for a user
 * @param {string} email - User email
 * @returns {Object} - { ok: boolean, userId?: number, alreadyVerified?: boolean, error?: string }
 */
export async function getVerificationStatusByEmail(email) {
  await ensureAuthTables();

  const rows = await query('SELECT id, email_verified FROM users WHERE email = ?', [email.trim().toLowerCase()]);

  if (!rows || rows.length === 0) {
    return { ok: false, error: 'User not found' };
  }

  const user = rows[0];

  if (user.email_verified) {
    return { ok: false, alreadyVerified: true };
  }

  return { ok: true, userId: user.id, alreadyVerified: false };
}
