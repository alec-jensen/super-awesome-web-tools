// @ts-nocheck
// Backup codes for 2FA recovery

import crypto from 'crypto';
import { encryptUrl, decryptUrl } from '../crypto.js';
import { getConfig } from '../config.js';

// Get encryption key for backup codes from config
function getBackupCodesEncryptionKey() {
  const config = getConfig();
  return config.app.encryptionKey;
}

const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 10;

/**
 * Generate a set of backup codes
 */
export function generateBackupCodes() {
  const codes = [];
  
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4)
      .toString('hex')
      .toUpperCase()
      .substring(0, BACKUP_CODE_LENGTH);
    codes.push(code);
  }
  
  return codes;
}

/**
 * Hash a backup code for storage
 */
function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Encrypt backup codes for storage
 */
export function encryptBackupCodes(codes) {
  // Hash each code before encryption for added security
  const hashedCodes = codes.map(code => ({
    hash: hashBackupCode(code),
    used: false
  }));
  
  const key = getBackupCodesEncryptionKey();
  return encryptUrl(JSON.stringify(hashedCodes), key);
}

/**
 * Decrypt backup codes from storage
 */
export function decryptBackupCodes(encrypted) {
  if (!encrypted) return [];
  
  try {
    const key = getBackupCodesEncryptionKey();
    const decrypted = decryptUrl(encrypted, key);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt backup codes:', error);
    return [];
  }
}

/**
 * Verify a backup code and mark it as used
 */
export function verifyAndUseBackupCode(encryptedCodes, code) {
  const codes = decryptBackupCodes(encryptedCodes);
  const codeHash = hashBackupCode(code.toUpperCase());
  
  const codeIndex = codes.findIndex(c => c.hash === codeHash && !c.used);
  
  if (codeIndex === -1) {
    return { valid: false, updatedCodes: null };
  }
  
  // Mark code as used
  codes[codeIndex].used = true;
  
  const key = getBackupCodesEncryptionKey();
  return {
    valid: true,
    updatedCodes: encryptUrl(JSON.stringify(codes), key),
    remainingCodes: codes.filter(c => !c.used).length
  };
}

/**
 * Check if there are any unused backup codes
 */
export function hasUnusedBackupCodes(encryptedCodes) {
  const codes = decryptBackupCodes(encryptedCodes);
  return codes.some(c => !c.used);
}

/**
 * Get count of remaining backup codes
 */
export function getRemainingBackupCodesCount(encryptedCodes) {
  const codes = decryptBackupCodes(encryptedCodes);
  return codes.filter(c => !c.used).length;
}
