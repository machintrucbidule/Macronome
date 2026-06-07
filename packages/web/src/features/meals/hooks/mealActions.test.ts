import { describe, expect, test } from 'vitest';
import type { NamedPortion, PantryItem } from '@macronome/shared';
import { resolveEntryDefaultUnit } from './mealActions';

// Default unit when adding an item to a meal (B-109): pin prefill → first portion → g.

const pin = (over: Partial<PantryItem>): PantryItem => ({
  id: 'pin-1',
  meal_slot_name: 'Petit déjeuner',
  food_id: 'food-1',
  unit: 'g',
  portion_id: null,
  order_index: 0,
  ...over,
});

const portion = (id: string, label: string): NamedPortion => ({ id, label, grams: 57 });

describe('resolveEntryDefaultUnit', () => {
  test('a garde-manger pin wins, carrying its stored unit/portion', () => {
    expect(resolveEntryDefaultUnit({ pin: pin({ unit: 'kg' }), portions: [] })).toEqual({
      unit: 'kg',
      portion_id: null,
    });
    expect(
      resolveEntryDefaultUnit({
        pin: pin({ unit: 'portion', portion_id: 'P' }),
        portions: [portion('Q', 'autre')],
      }),
    ).toEqual({ unit: 'portion', portion_id: 'P' });
  });

  test('a pin with a deleted portion (unit=portion, portion_id=null) falls back to g', () => {
    expect(
      resolveEntryDefaultUnit({ pin: pin({ unit: 'portion', portion_id: null }), portions: [] }),
    ).toEqual({ unit: 'g', portion_id: null });
  });

  test('no pin: defaults to the first portion (the picker list is label-asc)', () => {
    expect(
      resolveEntryDefaultUnit({
        pin: undefined,
        portions: [portion('a', 'assiette'), portion('b', 'bol')],
      }),
    ).toEqual({ unit: 'portion', portion_id: 'a' });
  });

  test("a recipe's single auto portion defaults the unit to one part", () => {
    expect(
      resolveEntryDefaultUnit({ pin: undefined, portions: [portion('r', 'portion')] }),
    ).toEqual({ unit: 'portion', portion_id: 'r' });
  });

  test('no pin and no portions → grams', () => {
    expect(resolveEntryDefaultUnit({ pin: undefined, portions: [] })).toEqual({
      unit: 'g',
      portion_id: null,
    });
  });
});
