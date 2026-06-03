import { expect, test } from 'vitest';
import { normalize } from './normalize.js';

// Neutral oracles for the diacritic-insensitive search key (spec/schema/indexes.md).
// No personal data — safe in CI. Asserts app-side parity with unaccent(lower(name)).

test('accented and plain spellings collapse to the same key', () => {
  expect(normalize('crème')).toBe('creme');
  expect(normalize('crème')).toBe(normalize('creme'));
});

test('ligatures fold (œ → oe, æ → ae, ß → ss)', () => {
  expect(normalize('Œuf')).toBe('oeuf');
  expect(normalize('Œuf')).toBe(normalize('oeuf'));
  expect(normalize('Tænia')).toBe('taenia');
  expect(normalize('Straße')).toBe('strasse');
});

test('lower-cases and strips a spread of French diacritics', () => {
  expect(normalize('Pâté')).toBe('pate');
  expect(normalize('Forêt Noire')).toBe('foret noire');
  expect(normalize('Çà et là')).toBe('ca et la');
});

test('collapses and trims surrounding/inner whitespace', () => {
  expect(normalize('  Poulet   rôti  ')).toBe('poulet roti');
});
