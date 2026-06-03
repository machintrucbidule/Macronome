import { expect, test } from 'vitest';
import { ACTIVITY_LEVELS, ACTIVITY_MULTIPLIERS, DEFAULT_ACTIVITY_LEVEL } from './activity.js';

// The five canonical multipliers are a fixed contract (spec/logic/00-conventions.md).
// Guard them so a stray edit can't silently shift every burn computation.

test('exposes the five canonical levels in order', () => {
  expect(ACTIVITY_LEVELS).toEqual([
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active',
  ]);
});

test('multipliers match the spec table', () => {
  expect(ACTIVITY_MULTIPLIERS).toEqual({
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  });
});

test('fallback is sedentary', () => {
  expect(DEFAULT_ACTIVITY_LEVEL).toBe('sedentary');
  expect(ACTIVITY_MULTIPLIERS[DEFAULT_ACTIVITY_LEVEL]).toBe(1.2);
});
