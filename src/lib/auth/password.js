// @ts-nocheck
// Password hashing utilities using Node's scrypt implementation.
// Format: scrypt$N$r$p$salt$hash (base64url encoded salt/hash)

import crypto from 'node:crypto';

const SCRYPT_N = 16384; // CPU/memory cost parameter (2^14)
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64; // 512-bit derived key
const SALT_LENGTH = 16;

function toBase64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const pad = str.length % 4;
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(normalized, 'base64');
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${toBase64Url(salt)}$${toBase64Url(derivedKey)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [ , Nstr, rStr, pStr, saltB64, hashB64 ] = parts;
  const N = Number(Nstr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const salt = fromBase64Url(saltB64);
  const expected = fromBase64Url(hashB64);
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
}
