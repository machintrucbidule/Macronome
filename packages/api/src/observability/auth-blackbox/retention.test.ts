import { describe, expect, it } from 'vitest';
import { countLines, MAX_RECORDS, shouldRotate } from './retention.js';

describe('shouldRotate', () => {
  it('rotates once the current file is full', () => {
    expect(shouldRotate(499, 500)).toBe(false);
    expect(shouldRotate(500, 500)).toBe(true);
    expect(shouldRotate(501, 500)).toBe(true);
  });

  it('defaults to the documented bound', () => {
    expect(MAX_RECORDS).toBe(500);
    expect(shouldRotate(MAX_RECORDS - 1)).toBe(false);
    expect(shouldRotate(MAX_RECORDS)).toBe(true);
  });
});

describe('countLines', () => {
  it('counts records with or without a trailing newline', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(2);
  });
});
