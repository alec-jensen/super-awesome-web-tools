// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { indexToCode, ALPHABET } from '../src/lib/codegen.js';

// Helper to compute expected codes for first N indexes brute force using same function

describe('indexToCode basic properties', () => {
  it('first characters iterate through alphabet', () => {
    for (let i = 0; i < ALPHABET.length; i++) {
      expect(indexToCode(i)).toBe(ALPHABET[i]);
    }
  });

  it('first two-char code follows last single-char', () => {
    const firstTwoIndex = ALPHABET.length; // after exhausting single-char space
    const code = indexToCode(firstTwoIndex);
    expect(code.length).toBe(2);
    expect(code).toBe(ALPHABET[0] + ALPHABET[0]); // aa
  });

  it('last two-char code before moving to length 3', () => {
    const lastTwoIndex = ALPHABET.length + (ALPHABET.length ** 2) - 1; // inclusive
    const code = indexToCode(lastTwoIndex);
    expect(code.length).toBe(2);
  });

  it('first three-char code', () => {
    const firstThreeIndex = ALPHABET.length + ALPHABET.length ** 2; // start of length=3
    const code = indexToCode(firstThreeIndex);
    expect(code).toBe(ALPHABET[0] + ALPHABET[0] + ALPHABET[0]);
  });

  it('throws on negative index', () => {
    expect(() => indexToCode(-1)).toThrow();
  });
});
