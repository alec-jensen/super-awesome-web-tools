// @ts-nocheck
// Common 2FA utilities

import { query } from '../db.js';
import { decryptTOTPSecret } from './totp.js';
import { getRemainingBackupCodesCount } from './backupCodes.js';

/**
 * Check if user has any 2FA method enabled
 */
export async function has2FAEnabled(userId) {
  const users = await query(
    'SELECT totp_enabled, email_2fa_enabled FROM users WHERE id = ?',
    [userId]
  );
  
  if (users.length === 0) return false;
  
  const user = users[0];
  
  // Check if TOTP is enabled
  if (user.totp_enabled) return true;
  
  // Check if email 2FA is enabled
  if (user.email_2fa_enabled) return true;
  
  // Check if user has any passkeys
  const passkeys = await query(
    'SELECT COUNT(*) as count FROM passkeys WHERE user_id = ?',
    [userId]
  );
  
  return passkeys[0].count > 0;
}

/**
 * Get 2FA status for a user
 */
export async function get2FAStatus(userId) {
  const users = await query(
    'SELECT totp_enabled, email_2fa_enabled, backup_codes FROM users WHERE id = ?',
    [userId]
  );
  
  if (users.length === 0) {
    throw new Error('User not found');
  }
  
  const user = users[0];
  
  const passkeys = await query(
    'SELECT COUNT(*) as count FROM passkeys WHERE user_id = ?',
    [userId]
  );
  
  return {
    totpEnabled: user.totp_enabled || false,
    emailEnabled: user.email_2fa_enabled || false,
    passkeyCount: passkeys[0].count || 0,
    backupCodesRemaining: user.backup_codes ? getRemainingBackupCodesCount(user.backup_codes) : 0,
    has2FA: user.totp_enabled || user.email_2fa_enabled || passkeys[0].count > 0
  };
}

/**
 * Require password confirmation for sensitive 2FA operations
 */
export async function verifyPasswordForUser(userId, password) {
  const { verifyPassword } = await import('./password.js');
  
  const users = await query(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );
  
  if (users.length === 0) {
    throw new Error('User not found');
  }
  
  return await verifyPassword(password, users[0].password_hash);
}
