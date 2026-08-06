import { describe, expect, it } from 'vitest';
import { defaultDirFor, nextSortDir } from './sortDir';

// B-299: a first click on a numeric or date column sorts descending (the useful direction — most
// calories, best rating, most recent); a text column sorts alphabetically. Re-clicking toggles.
type Field = 'name' | 'kcal' | 'created';
const DESC_FIRST: ReadonlySet<Field> = new Set<Field>(['kcal', 'created']);

describe('defaultDirFor', () => {
  it('starts a numeric column descending', () => {
    expect(defaultDirFor<Field>('kcal', DESC_FIRST)).toBe('desc');
  });

  it('starts a date column descending', () => {
    expect(defaultDirFor<Field>('created', DESC_FIRST)).toBe('desc');
  });

  it('starts a text column ascending', () => {
    expect(defaultDirFor<Field>('name', DESC_FIRST)).toBe('asc');
  });
});

describe('nextSortDir', () => {
  it('flips the direction when the same column is clicked again', () => {
    expect(nextSortDir<Field>('kcal', 'kcal', 'desc', DESC_FIRST)).toBe('asc');
    expect(nextSortDir<Field>('kcal', 'kcal', 'asc', DESC_FIRST)).toBe('desc');
    expect(nextSortDir<Field>('name', 'name', 'asc', DESC_FIRST)).toBe('desc');
  });

  it('uses the natural default when the column changes, whatever the current direction', () => {
    expect(nextSortDir<Field>('kcal', 'name', 'desc', DESC_FIRST)).toBe('desc');
    expect(nextSortDir<Field>('name', 'kcal', 'desc', DESC_FIRST)).toBe('asc');
  });
});
