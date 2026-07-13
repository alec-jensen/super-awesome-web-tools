// @ts-nocheck
// Encryption utilities for secure link shortening
// Uses AES-256-GCM for authenticated encryption

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16; // 128 bits for PBKDF2 salt
const PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation for PBKDF2-SHA256

/**
 * Generate a random encryption key
 * @param {number} [lengthBits=256] - Key length in bits (default 256 for AES-256)
 * @returns {string} Base64-encoded key
 */
export function generateKey(lengthBits = 256) {
  const lengthBytes = Math.ceil(lengthBits / 8);
  return crypto.randomBytes(lengthBytes).toString('base64url');
}

/**
 * Validate key strength (entropy check)
 * @param {string} base64Key - Base64url-encoded encryption key
 * @returns {Object} { ok: boolean, error?: string }
 */
export function validateKeyStrength(base64Key) {
  try {
    const keyBuffer = Buffer.from(base64Key, 'base64url');
    
    // Check minimum length (at least 16 bytes / 128 bits)
    if (keyBuffer.length < 16) {
      return { ok: false, error: 'Key too short (minimum 128 bits)' };
    }
    
    // Check maximum reasonable length (512 bytes)
    if (keyBuffer.length > 512) {
      return { ok: false, error: 'Key too long (maximum 4096 bits)' };
    }
    
    // Basic entropy check: ensure key is not all zeros or all same byte
    const uniqueBytes = new Set(keyBuffer);
    if (uniqueBytes.size < 2) {
      return { ok: false, error: 'Key has insufficient entropy' };
    }
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Invalid key format' };
  }
}

/**
 * Encrypt a URL with a given key
 * @param {string} url - The URL to encrypt
 * @param {string} base64Key - Base64url-encoded encryption key
 * @returns {string} Base64url-encoded encrypted data
 */
export function encryptUrl(url, base64Key) {
  const keyBuffer = Buffer.from(base64Key, 'base64url');
  
  // For AES-256-GCM we need exactly 32 bytes
  let key;
  let salt = null;
  
  if (keyBuffer.length === KEY_LENGTH) {
    // Perfect length, use directly
    key = keyBuffer;
  } else {
    // Generate random salt for key derivation
    salt = crypto.randomBytes(SALT_LENGTH);
    key = crypto.pbkdf2Sync(keyBuffer, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(url, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format depends on whether we used PBKDF2
  let combined;
  if (salt) {
    // salt + iv + authTag + encrypted
    combined = Buffer.concat([salt, iv, authTag, encrypted]);
  } else {
    // iv + authTag + encrypted (original format for 256-bit keys)
    combined = Buffer.concat([iv, authTag, encrypted]);
  }
  
  return combined.toString('base64url');
}

/**
 * Decrypt an encrypted URL
 * @param {string} encryptedData - Base64url-encoded encrypted data
 * @param {string} base64Key - Base64url-encoded encryption key
 * @returns {string} Decrypted URL
 */
export function decryptUrl(encryptedData, base64Key) {
  const keyBuffer = Buffer.from(base64Key, 'base64url');
  const combined = Buffer.from(encryptedData, 'base64url');
  
  // Determine format by checking if key length matches KEY_LENGTH
  let key;
  let offset = 0;
  
  if (keyBuffer.length === KEY_LENGTH) {
    // Original format: iv + authTag + encrypted
    key = keyBuffer;
  } else {
    // New format: salt + iv + authTag + encrypted
    const salt = combined.subarray(0, SALT_LENGTH);
    offset = SALT_LENGTH;
    key = crypto.pbkdf2Sync(keyBuffer, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }
  
  // Extract iv, authTag, and ciphertext
  const iv = combined.subarray(offset, offset + IV_LENGTH);
  const authTag = combined.subarray(offset + IV_LENGTH, offset + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(offset + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Decode a key from URL fragment
 * @param {string} encodedKey - Encoded key from URL
 * @returns {string} Base64url-encoded key
 */
export function decodeKeyFromUrl(encodedKey) {
  return encodedKey;
}
