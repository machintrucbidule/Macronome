import { describe, expect, it } from 'vitest';
import { createThrottle } from './warn-throttle.js';

const INTERVAL = 1000;

// B-231 prescribed work 3: the replacement for the one-shot latch must RE-ARM. A gate that can be
// permanently silenced is the bug being fixed, so that is the case worth pinning.
describe('createThrottle', () => {
  it('allows the first occurrence', () => {
    expect(createThrottle(INTERVAL).allow(0)).toBe(true);
  });

  it('suppresses occurrences inside the window', () => {
    const gate = createThrottle(INTERVAL);
    gate.allow(0);
    expect(gate.allow(1)).toBe(false);
    expect(gate.allow(999)).toBe(false);
  });

  it('re-arms once the window has elapsed (never permanently silenced)', () => {
    const gate = createThrottle(INTERVAL);
    gate.allow(0);
    gate.allow(500);
    expect(gate.allow(1000)).toBe(true);
    expect(gate.allow(2000)).toBe(true);
  });

  it('counts what it suppressed and resets on drain', () => {
    const gate = createThrottle(INTERVAL);
    gate.allow(0);
    gate.allow(1);
    gate.allow(2);
    expect(gate.drain()).toBe(2);
    expect(gate.drain()).toBe(0);
  });
});
