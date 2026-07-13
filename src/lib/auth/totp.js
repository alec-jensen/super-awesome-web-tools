// @ts-nocheck
// TOTP (Time-based One-Time Password) implementation for 2FA
// Uses HMAC-SHA1 algorithm as per RFC 6238

import crypto from 'crypto';
import { encryptUrl, decryptUrl } from '../crypto.js';
import { getConfig } from '../config.js';

// Get encryption key for TOTP secrets from config
function getTOTPEncryptionKey() {
  const config = getConfig();
  return config.app.encryptionKey;
}

const TOTP_WINDOW = 1; // Allow 1 step before/after (30 seconds each)
const TOTP_STEP = 30; // 30 seconds per code
const TOTP_DIGITS = 6; // 6-digit codes

/**
 * Generate a random base32 secret for TOTP
 */
export function generateTOTPSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate TOTP code for a given secret and time
 */
function generateTOTP(secret, timeStep) {
  const key = base32Decode(secret);
  const time = Buffer.alloc(8);
  time.writeBigUInt64BE(BigInt(timeStep));
  
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(time);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0xf;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_DIGITS);
  
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTP(secret, token) {
  const now = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(now / TOTP_STEP);
  
  // Check current time and window before/after
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const code = generateTOTP(secret, timeStep + i);
    if (code === token) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate a QR code URL for TOTP setup
 */
export function getTOTPQRCodeURL(email, secret, issuer = 'super-awesome-web-tools') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS.toString(),
    period: TOTP_STEP.toString()
  });
  
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Encrypt TOTP secret for storage
 */
export function encryptTOTPSecret(secret) {
  const key = getTOTPEncryptionKey();
  return encryptUrl(secret, key);
}

/**
 * Decrypt TOTP secret from storage
 */
export function decryptTOTPSecret(encrypted) {
  const key = getTOTPEncryptionKey();
  return decryptUrl(encrypted, key);
}

/**
 * Base32 encoding (RFC 4648)
 */
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  
  return output;
}

/**
 * Base32 decoding (RFC 4648)
 */
function base32Decode(string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.ceil(string.length * 5 / 8));
  
  for (let i = 0; i < string.length; i++) {
    const char = string[i].toUpperCase();
    if (char === '=') break;
    
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    
    value = (value << 5) | val;
    bits += 5;
    
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  
  return output.slice(0, index);
}
