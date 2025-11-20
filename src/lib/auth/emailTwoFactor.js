// @ts-nocheck
// Email-based Two-Factor Authentication
// Generates and verifies time-limited codes sent via email

import crypto from 'crypto';
import { query } from '../db.js';
import { sendEmail, isEmailEnabled } from '../email.js';

/**
 * Generate a random 6-digit verification code
 */
function generateEmailCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send a 2FA code to user's email
 * @param {string} email - User's email address
 * @param {number} userId - User's ID
 * @param {string} [idempotencyKey] - Optional idempotency key to prevent duplicate sends
 * @returns {Promise<boolean>} - True if code was sent successfully
 */
export async function sendEmail2FACode(email, userId, idempotencyKey = null) {
  if (!isEmailEnabled()) {
    throw new Error('Email is not configured');
  }

  // If idempotency key is provided, check if we already sent a code with this key
  if (idempotencyKey) {
    const existing = await query(
      `SELECT email_2fa_code, email_2fa_code_expires_at, email_2fa_idempotency_key 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (existing.length > 0 && existing[0].email_2fa_idempotency_key === idempotencyKey) {
      // Check if the existing code is still valid
      if (existing[0].email_2fa_code && new Date() < new Date(existing[0].email_2fa_code_expires_at)) {
        // Code already sent with this idempotency key and still valid, don't send again
        return true;
      }
    }
  }

  // Generate a new code
  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store code in database with idempotency key
  await query(
    `UPDATE users 
     SET email_2fa_code = ?, 
         email_2fa_code_expires_at = ?, 
         email_2fa_code_attempts = 0,
         email_2fa_idempotency_key = ?
     WHERE id = ?`,
    [code, expiresAt, idempotencyKey, userId]
  );

  // Send email
  await sendEmail({
    to: email,
    subject: 'Your Two-Factor Authentication Code',
    text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3245ff;">Two-Factor Authentication</h2>
        <p>Your verification code is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280;">This code will expire in 10 minutes.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
  });

  return true;
}

/**
 * Verify an email 2FA code
 * @param {number} userId - User's ID
 * @param {string} code - The code to verify
 * @returns {Promise<boolean>} - True if code is valid
 */
export async function verifyEmail2FACode(userId, code) {
  const rows = await query(
    `SELECT email_2fa_code, email_2fa_code_expires_at, email_2fa_code_attempts 
     FROM users 
     WHERE id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    return false;
  }

  const user = rows[0];

  // Check if code exists
  if (!user.email_2fa_code) {
    return false;
  }

  // Check if code expired
  if (new Date() > new Date(user.email_2fa_code_expires_at)) {
    // Clear expired code
    await query(
      `UPDATE users 
       SET email_2fa_code = NULL, 
           email_2fa_code_expires_at = NULL, 
           email_2fa_code_attempts = 0,
           email_2fa_idempotency_key = NULL
       WHERE id = ?`,
      [userId]
    );
    return false;
  }

  // Check attempt limit (max 5 attempts)
  if (user.email_2fa_code_attempts >= 5) {
    // Clear code after too many attempts
    await query(
      `UPDATE users 
       SET email_2fa_code = NULL, 
           email_2fa_code_expires_at = NULL, 
           email_2fa_code_attempts = 0,
           email_2fa_idempotency_key = NULL
       WHERE id = ?`,
      [userId]
    );
    return false;
  }

  // Verify code
  if (user.email_2fa_code === code) {
    // Clear code after successful verification
    await query(
      `UPDATE users 
       SET email_2fa_code = NULL, 
           email_2fa_code_expires_at = NULL, 
           email_2fa_code_attempts = 0,
           email_2fa_idempotency_key = NULL
       WHERE id = ?`,
      [userId]
    );
    return true;
  }

  // Increment attempt counter
  await query(
    `UPDATE users 
     SET email_2fa_code_attempts = email_2fa_code_attempts + 1 
     WHERE id = ?`,
    [userId]
  );

  return false;
}

/**
 * Enable email 2FA for a user
 * @param {number} userId - User's ID
 */
export async function enableEmail2FA(userId) {
  await query(
    'UPDATE users SET email_2fa_enabled = TRUE WHERE id = ?',
    [userId]
  );
}

/**
 * Disable email 2FA for a user
 * @param {number} userId - User's ID
 */
export async function disableEmail2FA(userId) {
  await query(
    `UPDATE users 
     SET email_2fa_enabled = FALSE, 
         email_2fa_code = NULL, 
         email_2fa_code_expires_at = NULL, 
         email_2fa_code_attempts = 0,
         email_2fa_idempotency_key = NULL
     WHERE id = ?`,
    [userId]
  );
}

/**
 * Check if user has email 2FA enabled
 * @param {number} userId - User's ID
 * @returns {Promise<boolean>}
 */
export async function isEmail2FAEnabled(userId) {
  const rows = await query(
    'SELECT email_2fa_enabled FROM users WHERE id = ?',
    [userId]
  );
  
  return rows.length > 0 && rows[0].email_2fa_enabled;
}
