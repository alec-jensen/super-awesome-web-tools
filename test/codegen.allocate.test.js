// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { _setDbForTests, allocateCode, recycleCode, ALPHABET } from '../src/lib/codegen.js';

// In-memory simulation of tables
let codeState; // { next_index }
let recycled; // Set of codes

function resetDb() {
  codeState = { next_index: 0 };
  recycled = new Map(); // code -> {code_length}
}

// Minimal query emulator; only handles queries used by codegen
async function fakeQuery(sql, params = []) {
  sql = sql.trim();
  if (sql.startsWith('CREATE TABLE')) return [];
  if (sql.startsWith('INSERT IGNORE INTO code_state')) {
    if (codeState == null) codeState = { next_index: 0 };
    return { affectedRows: 1 };
  }
  if (sql.startsWith('INSERT IGNORE INTO recycled_codes')) {
    const code = params[0];
    if (!recycled.has(code)) recycled.set(code, { code_length: params[1] });
    return { affectedRows: 1 };
  }
  if (sql.startsWith('SELECT short_code FROM recycled_codes')) {
    // Order by length then lexicographically
    const arr = [...recycled.entries()]
      .sort((a,b) => a[1].code_length - b[1].code_length || a[0].localeCompare(b[0]))
      .slice(0,1)
      .map(e => ({ short_code: e[0] }));
    return arr;
  }
  if (sql.startsWith('DELETE FROM recycled_codes')) {
    const code = params[0];
    recycled.delete(code);
    return { affectedRows: 1 };
  }
  if (sql.startsWith('SELECT next_index FROM code_state')) {
    return [{ next_index: codeState.next_index }];
  }
  if (sql.startsWith('UPDATE code_state SET next_index = next_index + 1')) {
    codeState.next_index += 1;
    return { affectedRows: 1 };
  }
  throw new Error('Unhandled SQL in fakeQuery: ' + sql);
}

async function fakeWithConnection(fn) {
  // Provide a minimal conn object with query + transaction methods
  const conn = {
    async query(sql, params) { return fakeQuery(sql, params); },
    async beginTransaction() {},
    async commit() {},
    async rollback() {}
  };
  return fn(conn);
}

beforeEach(() => {
  resetDb();
  _setDbForTests({ query: fakeQuery, withConnection: fakeWithConnection });
});

describe('allocateCode sequential behavior', () => {
  it('allocates first alphabet run then moves to two-char', async () => {
    // allocate first |ALPHABET| + 1 codes
    const produced = [];
    for (let i = 0; i < ALPHABET.length + 1; i++) {
      const { code, reused } = await allocateCode();
      produced.push(code);
      expect(reused).toBe(false);
    }
    // First codes should equal alphabet characters in order
    for (let i = 0; i < ALPHABET.length; i++) {
      expect(produced[i]).toBe(ALPHABET[i]);
    }
    // Next code after exhausting single chars should be 'aa'
    expect(produced[ALPHABET.length]).toBe(ALPHABET[0] + ALPHABET[0]);
  });

  it('recycles smallest code first', async () => {
    const a = (await allocateCode()).code; // a
    const b = (await allocateCode()).code; // b
    const c = (await allocateCode()).code; // c
    expect([a,b,c]).toEqual([ALPHABET[0], ALPHABET[1], ALPHABET[2]]);

    await recycleCode(b); // recycle 'b'
    const next = await allocateCode(); // should reuse 'b'
    expect(next).toEqual({ code: b, reused: true });
  });

  it('recycling longer code not chosen before shorter', async () => {
    // allocate first alphabet fully, plus two more to reach 'aa' and 'ab'
    const singleCodes = [];
    for (let i = 0; i < ALPHABET.length + 2; i++) {
      singleCodes.push((await allocateCode()).code);
    }
    const aa = singleCodes[ALPHABET.length];
    const ab = singleCodes[ALPHABET.length + 1];
    // Recycle 'aa' and first single code 'a'
    await recycleCode(aa);
    await recycleCode(singleCodes[0]);
    const next = await allocateCode();
    // Should prefer shorter single-char 'a'
    expect(next.code).toBe(singleCodes[0]);
  });
});
