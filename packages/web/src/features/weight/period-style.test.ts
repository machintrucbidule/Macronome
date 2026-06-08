import { describe, expect, it } from 'vitest';
import { activityLevelFromMultiplier, deltaArrow, signTone } from './period-style';

describe('signTone (WV-1 / B-115)', () => {
  it('negative is "good" (pos) — weight down / below trajectory / deficit', () => {
    expect(signTone(-1.2)).toBe('pos');
  });
  it('positive is "bad" (neg) — weight up / above trajectory / surplus', () => {
    expect(signTone(0.5)).toBe('neg');
  });
  it('zero is neutral (null)', () => {
    expect(signTone(0)).toBeNull();
  });
});

describe('deltaArrow (WV-1 / B-115)', () => {
  it('▼ when losing', () => expect(deltaArrow(-0.3)).toBe('▼'));
  it('▲ when gaining', () => expect(deltaArrow(0.3)).toBe('▲'));
  it('none at 0', () => expect(deltaArrow(0)).toBeNull());
});

describe('activityLevelFromMultiplier (WV-1 / B-115)', () => {
  it('maps the canonical multipliers to their own level', () => {
    expect(activityLevelFromMultiplier(1.2)).toBe('sedentary');
    expect(activityLevelFromMultiplier(1.375)).toBe('lightly_active');
    expect(activityLevelFromMultiplier(1.55)).toBe('moderately_active');
    expect(activityLevelFromMultiplier(1.725)).toBe('very_active');
    expect(activityLevelFromMultiplier(1.9)).toBe('extremely_active');
  });
  it('rounds an in-between average to the nearest level', () => {
    // 1.30 is closer to 1.375 (0.075) than to 1.2 (0.10)
    expect(activityLevelFromMultiplier(1.3)).toBe('lightly_active');
    // 1.62 is closer to 1.55 (0.07) than to 1.725 (0.105)
    expect(activityLevelFromMultiplier(1.62)).toBe('moderately_active');
  });
  it('clamps below/above the range to the end levels', () => {
    expect(activityLevelFromMultiplier(1.0)).toBe('sedentary');
    expect(activityLevelFromMultiplier(2.5)).toBe('extremely_active');
  });
});
