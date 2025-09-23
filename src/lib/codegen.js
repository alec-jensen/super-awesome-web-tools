// @ts-nocheck
// Sequential short code generator with recycling of freed codes.
// Strategy:
// 1. Try to reuse smallest-length, lexicographically smallest code from recycled_codes.
// 2. If none available, allocate next sequential index from code_state and convert to code using alphabet.
// 3. Allocation performed inside a transaction (FOR UPDATE row lock) to avoid race conditions.
//
// Alphabet comes from the existing endpoint; ensure we keep it centralized here.

import { query as realQuery, withConnection as realWithConnection } from './db.js';

// these are all characters that can safely appear in url paths
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~!$&\'()*+,;=@:';
const BASE = ALPHABET.length;
const MAX_LEN = 16; // matches short_code column size

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
export async function allocateCode() {
  await ensureCodegenTables();
  return _withConnection(async (conn) => {
    await conn.beginTransaction();
    try {
      // Attempt recycled first
  const recycled = await conn.query('SELECT short_code FROM recycled_codes ORDER BY code_length ASC, short_code ASC LIMIT 1 FOR UPDATE');
      if (recycled.length > 0) {
        const code = recycled[0].short_code;
        await conn.query('DELETE FROM recycled_codes WHERE short_code = ?', [code]);
        await conn.commit();
        return { code, reused: true };
      }
      // Lock state row
      const rows = await conn.query('SELECT next_index FROM code_state WHERE id=1 FOR UPDATE');
      if (!rows.length) throw new Error('code_state row missing');
      const nextIndex = Number(rows[0].next_index);
      const code = indexToCode(nextIndex);
      // increment
      await conn.query('UPDATE code_state SET next_index = next_index + 1 WHERE id=1');
      await conn.commit();
      return { code, reused: false };
    } catch (err) {
      try { await conn.rollback(); } catch {}
      throw err;
    }
  });
}

// Mark a code as recyclable (for future reuse). Not used yet by endpoints.
export async function recycleCode(code) {
  if (!code) return;
  await ensureCodegenTables();
  await _query('INSERT IGNORE INTO recycled_codes (short_code, code_length) VALUES (?, ?)', [code, code.length]);
}
