// @ts-nocheck
// Account lockout and failed login attempt management

import crypto from 'node:crypto';
import { query } from '../db.js';
import { getConfig } from '../config.js';
import { ensureAuthTables } from './tables.js';
import { isEmailEnabled, sendEmail } from '../email.js';

/**
 * Check if account is currently locked
 */
export async function isAccountLocked(userId) {
  await ensureAuthTables();
  const rows = await query(
    'SELECT locked_until FROM users WHERE id = ?',
    [userId]
  );
  
  if (!rows || rows.length === 0) return false;
  
  const lockedUntil = rows[0].locked_until;
  if (!lockedUntil) return false;
  
  const now = new Date();
  const lockExpiry = new Date(lockedUntil);
  
  return lockExpiry > now;
}

/**
 * Calculate exponential delay in seconds based on number of attempts
 */
function calculateDelay(attempts, baseDelay) {
  // Exponential backoff: baseDelay * 2^(attempts-1)
  // e.g., with baseDelay=2: 2s, 4s, 8s, 16s, 32s...
  return baseDelay * Math.pow(2, attempts - 1);
}

/**
 * Get required delay before next login attempt
 * Returns null if no delay required, otherwise returns delay in seconds
 */
export async function getLoginDelay(userId) {
  await ensureAuthTables();
  const config = getConfig();
  
  if (!config.auth.lockout.enabled || !config.auth.lockout.exponentialDelay) {
    return null;
  }
  
  const rows = await query(
    'SELECT failed_login_attempts, last_failed_login_at FROM users WHERE id = ?',
    [userId]
  );
  
  if (!rows || rows.length === 0 || rows[0].failed_login_attempts === 0) {
    return null;
  }
  
  const attempts = rows[0].failed_login_attempts;
  const lastFailedAt = rows[0].last_failed_login_at;
  
  if (!lastFailedAt) return null;
  
  const delaySeconds = calculateDelay(attempts, config.auth.lockout.baseDelaySeconds);
  const requiredWaitUntil = new Date(lastFailedAt);
  requiredWaitUntil.setSeconds(requiredWaitUntil.getSeconds() + delaySeconds);
  
  const now = new Date();
  if (now < requiredWaitUntil) {
    const remainingSeconds = Math.ceil((requiredWaitUntil - now) / 1000);
    return remainingSeconds;
  }
  
  return null;
}

/**
 * Record a failed login attempt
 * Returns true if account should be locked, false otherwise
 */
export async function recordFailedLogin(userId) {
  await ensureAuthTables();
  const config = getConfig();
  
  if (!config.auth.lockout.enabled) {
    return false;
  }
  
  // Increment failed attempts
  await query(
    'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login_at = NOW() WHERE id = ?',
    [userId]
  );
  
  // Check if we should lock the account
  const rows = await query(
    'SELECT failed_login_attempts, email FROM users WHERE id = ?',
    [userId]
  );
  
  if (!rows || rows.length === 0) return false;
  
  const attempts = rows[0].failed_login_attempts;
  const email = rows[0].email;
  
  if (attempts >= config.auth.lockout.maxAttempts) {
    // Lock the account
    await lockAccount(userId, email);
    return true;
  }
  
  return false;
}

/**
 * Lock an account and optionally send email
 */
async function lockAccount(userId, email) {
  await ensureAuthTables();
  const config = getConfig();
  
  const lockoutMinutes = config.auth.lockout.lockoutDurationMinutes;
  const unlockToken = crypto.randomBytes(32).toString('hex');
  
  await query(
    `UPDATE users 
     SET locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
         account_unlock_token = ?
     WHERE id = ?`,
    [lockoutMinutes, unlockToken, userId]
  );
  
  // Send lockout email if enabled and SMTP is configured
  if (config.auth.lockout.sendLockoutEmail && isEmailEnabled()) {
    try {
      await sendLockoutEmail(email, unlockToken, lockoutMinutes);
    } catch (err) {
      console.error('[lockout] Failed to send lockout email:', err);
    }
  }
}

/**
 * Send account lockout notification email
 */
async function sendLockoutEmail(email, unlockToken, lockoutMinutes) {
  const baseUrl = getConfig().app.baseUrl;
  const unlockUrl = `${baseUrl}/unlock-account?token=${unlockToken}`;
  
  const html = `
    <h2>Account Locked</h2>
    <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
    <p>The lock will automatically expire in ${lockoutMinutes} minutes.</p>
    <p>If you would like to unlock your account immediately, click the link below:</p>
    <p><a href="${unlockUrl}">Unlock My Account</a></p>
    <p>If you did not attempt to log in, please change your password immediately after unlocking your account.</p>
    <p>For security reasons, this unlock link will expire when the automatic lockout period ends.</p>
  `;
  
  const text = `
Account Locked

Your account has been temporarily locked due to multiple failed login attempts.

The lock will automatically expire in ${lockoutMinutes} minutes.

If you would like to unlock your account immediately, visit:
${unlockUrl}

If you did not attempt to log in, please change your password immediately after unlocking your account.

For security reasons, this unlock link will expire when the automatic lockout period ends.
  `;
  
  await sendEmail({
    to: email,
    subject: 'Account Locked - Security Alert',
    text,
    html
  });
}

/**
 * Reset failed login attempts (called on successful login)
 */
export async function resetFailedAttempts(userId) {
  await ensureAuthTables();
  await query(
    'UPDATE users SET failed_login_attempts = 0, last_failed_login_at = NULL WHERE id = ?',
    [userId]
  );
}

/**
 * Unlock account using unlock token
 */
export async function unlockAccount(token) {
  await ensureAuthTables();
  
  const rows = await query(
    'SELECT id, locked_until FROM users WHERE account_unlock_token = ?',
    [token]
  );
  
  if (!rows || rows.length === 0) {
    return { success: false, error: 'Invalid or expired unlock token' };
  }
  
  const userId = rows[0].id;
  const lockedUntil = rows[0].locked_until;
  
  // Check if lock has already expired
  if (lockedUntil && new Date(lockedUntil) < new Date()) {
    return { success: false, error: 'This unlock link has expired' };
  }
  
  // Unlock the account
  await query(
    `UPDATE users 
     SET locked_until = NULL,
         account_unlock_token = NULL,
         failed_login_attempts = 0,
         last_failed_login_at = NULL
     WHERE id = ?`,
    [userId]
  );
  
  return { success: true };
}
