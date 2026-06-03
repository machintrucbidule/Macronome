import { expect, test } from 'vitest';
import { passesMinRating, RATING_GRADES, UNRATED_DISPLAY } from './rating.js';

// Neutral oracles for the rating scale (spec/logic/00-conventions.md §"Rating
// scale", DECISIONS.md Gap #7). No personal data — safe in CI.

test('the four real grades are 0..3 (Bof..Top)', () => {
  expect(RATING_GRADES).toEqual([0, 1, 2, 3]);
});

test('unrated is rendered as an em-dash, distinct from Bof (0)', () => {
  expect(UNRATED_DISPLAY).toBe('—');
});

test('min-rating filter keeps only grades >= min', () => {
  expect(passesMinRating(3, 3)).toBe(true);
  expect(passesMinRating(2, 3)).toBe(false);
  expect(passesMinRating(2, 2)).toBe(true);
  expect(passesMinRating(1, 1)).toBe(true);
});

test('">= 1" filter excludes BOTH Bof (0) and unrated (null)', () => {
  expect(passesMinRating(0, 1)).toBe(false);
  expect(passesMinRating(null, 1)).toBe(false);
  expect(passesMinRating(null, 2)).toBe(false);
  expect(passesMinRating(null, 3)).toBe(false);
});
