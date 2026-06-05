import { describe, expect, it } from 'vitest';
import { diffCookLines } from './cookDiff';
import type { CookLine } from '../modals/CookModeModal/useCookSession';

const ref = (over: Partial<CookLine>): CookLine => ({
  id: 'a',
  kind: 'referenced',
  food_id: 'f1',
  custom_name: null,
  served_quantity: 100,
  unit: 'g',
  portion_id: null,
  served_grams: null,
  ...over,
});

describe('diffCookLines', () => {
  it('emits a patch carrying only the changed fields', () => {
    const before = [ref({})];
    const after = [ref({ served_quantity: 150 })];
    expect(diffCookLines(before, after)).toEqual([{ id: 'a', body: { served_quantity: 150 } }]);
  });

  it('combines a food + unit change on one entry', () => {
    const before = [ref({})];
    const after = [ref({ food_id: 'f2', unit: 'ml' })];
    expect(diffCookLines(before, after)).toEqual([
      { id: 'a', body: { food_id: 'f2', unit: 'ml' } },
    ]);
  });

  it('skips unchanged and custom lines', () => {
    const custom: CookLine = {
      ...ref({ id: 'c', kind: 'custom', food_id: null }),
      served_grams: 50,
    };
    const before = [ref({}), { ...custom }];
    const after = [ref({}), { ...custom, served_quantity: 999 }];
    expect(diffCookLines(before, after)).toEqual([]);
  });
});
