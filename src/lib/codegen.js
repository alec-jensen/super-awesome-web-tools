// @ts-nocheck
// Sequential short code generator with recycling of freed codes.
// Strategy:
// 1. Try to reuse smallest-length, lexicographically smallest code from recycled_codes.
// 2. If none available, allocate next sequential index from code_state and convert to code using alphabet.
// 3. Allocation performed inside a transaction (FOR UPDATE row lock) to avoid race conditions.
// 4. Internal rate limiting prevents runaway allocation loops and connection pool exhaustion.
//
// Alphabet comes from the existing endpoint; ensure we keep it centralized here.

import { query as realQuery, withConnection as realWithConnection } from './db.js';
import { getConfig } from './config.js';

// Track concurrent allocations for internal rate limiting (L-1)
let concurrentAllocations = 0;

// these are all characters that can safely appear in url paths
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~!$&\'()*+,;=@:';
const BASE = ALPHABET.length;
const MAX_LEN = 16; // matches short_code column size

// Reserved codes that should never be allocated (must match middleware.js reserved set)
export const RESERVED_CODES = new Set([
  'api',
  'app',
  'security',
  'login',
  'register',
  'logout',
  '_astro',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
]);

// Convert 0-based sequential index to code: produce minimal length representation.
// Sequence: a, b, c, ..., (alphabet chars), aa, ab, ...
export function indexToCode(index) {
  if (index < 0) throw new Error('Negative index');
  // Determine length L such that sum_{k=1..L} BASE^k > index
  let remaining = index;
  let length = 1;
  let blockSize = BASE; // BASE^length
  let consumed = 0;
  while (remaining >= blockSize) {
    remaining -= blockSize;
    length++;
    if (length > MAX_LEN) throw new Error('Exhausted code space (length > MAX_LEN)');
    blockSize *= BASE; // BASE^length
  }
  // remaining is offset within codes of this length (0 .. BASE^length-1)
  // Represent remaining in base BASE with exactly `length` digits.
  let n = remaining;
  let chars = Array(length).fill('a');
  for (let pos = length - 1; pos >= 0; pos--) {
    const digit = n % BASE;
    chars[pos] = ALPHABET[digit];
    n = Math.floor(n / BASE);
  }
  return chars.join('');
}

let _query = realQuery;
let _withConnection = realWithConnection;

export function _setDbForTests({ query, withConnection } = {}) {
  if (query) _query = query;
  if (withConnection) _withConnection = withConnection;
}

export async function ensureCodegenTables() {
  await _query(`CREATE TABLE IF NOT EXISTS code_state (
    id TINYINT PRIMARY KEY CHECK (id = 1),
    next_index BIGINT UNSIGNED NOT NULL
  ) ENGINE=InnoDB`);
  await _query(`CREATE TABLE IF NOT EXISTS recycled_codes (
    short_code VARCHAR(16) PRIMARY KEY,
    code_length TINYINT NOT NULL,
    recycled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  // Initialize state row if missing
  await _query(`INSERT IGNORE INTO code_state (id, next_index) VALUES (1, 0)`);
}

// Allocate next code; returns { code, reused:boolean }
// L-1: Internal rate limiting prevents connection pool exhaustion
// L-2: Generic error messages for security (detailed errors logged server-side)
export async function allocateCode() {
  await ensureCodegenTables();
  
  // L-1: Check concurrent allocation limit to prevent connection pool exhaustion
  const config = getConfig();
  const maxConcurrent = config.limits?.maxConcurrentAllocations ?? 50;
  
  if (concurrentAllocations >= maxConcurrent) {
    console.error(`[codegen] Concurrent allocation limit reached: ${concurrentAllocations}/${maxConcurrent}`);
    // L-2: Generic error message (detailed logged above)
    throw new Error('Service temporarily unavailable');
  }
  
  concurrentAllocations++;
  
  try {
    return await _allocateCodeInternal();
  } finally {
    concurrentAllocations--;
  }
}

// Internal allocation logic (separated for rate limiting wrapper)
async function _allocateCodeInternal() {
  const config = getConfig();
  const maxRetries = config.limits?.codeAllocationRetries ?? 10;
  let retries = 0;
  
  return _withConnection(async (conn) => {
    await conn.beginTransaction();
    try {
      // Attempt recycled first (skip reserved codes)
      const recycled = await conn.query('SELECT short_code FROM recycled_codes ORDER BY code_length ASC, short_code ASC LIMIT 10 FOR UPDATE');
      if (recycled.length > 0) {
        // Find first non-reserved code
        for (const row of recycled) {
          const code = row.short_code;
          if (!RESERVED_CODES.has(code)) {
            await conn.query('DELETE FROM recycled_codes WHERE short_code = ?', [code]);
            await conn.commit();
            return { code, reused: true };
          }
        }
      }
      
      // Lock state row
      const rows = await conn.query('SELECT next_index FROM code_state WHERE id=1 FOR UPDATE');
      if (!rows.length) {
        // L-2: Log detailed error server-side
        console.error('[codegen] code_state table is missing initialization row');
        // L-2: Return generic error to client
        throw new Error('Service configuration error');
      }
      
      let nextIndex = Number(rows[0].next_index);
      let code = indexToCode(nextIndex);
      
      // Skip reserved codes by incrementing until we find a non-reserved one
      // L-1: Prevent infinite loops with retry limit
      while (RESERVED_CODES.has(code)) {
        retries++;
        if (retries > maxRetries) {
          // L-2: Log detailed error server-side
          console.error(`[codegen] Exceeded retry limit (${maxRetries}) while skipping reserved codes. Current index: ${nextIndex}`);
          // L-2: Return generic error to client
          throw new Error('Service temporarily unavailable');
        }
        nextIndex++;
        code = indexToCode(nextIndex);
      }
      
      // Update to the next index after our allocated code
      await conn.query('UPDATE code_state SET next_index = ? WHERE id=1', [nextIndex + 1]);
      await conn.commit();
      return { code, reused: false };
    } catch (err) {
      try { await conn.rollback(); } catch {}
      // L-2: Log detailed error server-side, re-throw (will be caught by wrapper or caller)
      if (err.message === 'Service temporarily unavailable' || err.message === 'Service configuration error') {
        // Already a generic error, just re-throw
        throw err;
      }
      // L-2: Log unexpected errors with details
      console.error('[codegen] Unexpected error during code allocation:', err);
      // L-2: Return generic error to client
      throw new Error('Service error');
    }
  });
}

// Mark a code as recyclable (for future reuse). Not used yet by endpoints.
export async function recycleCode(code) {
  if (!code) return;
  // Never recycle reserved codes
  if (RESERVED_CODES.has(code)) return;
  await ensureCodegenTables();
  await _query('INSERT IGNORE INTO recycled_codes (short_code, code_length) VALUES (?, ?)', [code, code.length]);
}

// Get current allocation metrics (for monitoring/debugging)
export function getAllocationMetrics() {
  return {
    concurrentAllocations,
    timestamp: new Date().toISOString()
  };
}
