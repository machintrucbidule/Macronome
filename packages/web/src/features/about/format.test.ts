import { describe, expect, test } from 'vitest';
import { formatBytes, formatDuration } from './format';

describe('formatBytes', () => {
  test('scales through the binary units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });
  test('guards non-finite / negative', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  test('formats coarse durations, minutes always shown', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(90)).toBe('1 min');
    expect(formatDuration(3700)).toBe('1 h 1 min');
    expect(formatDuration(90061)).toBe('1 j 1 h 1 min');
  });
});
