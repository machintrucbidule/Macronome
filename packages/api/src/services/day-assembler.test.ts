import { describe, expect, it } from 'vitest';
import type { MealEntry as MealEntryModel } from '@prisma/client';
import { mealEntryDto } from './day-assembler.js';

// consumed.quantity is the consumed amount in the line's own unit (B-047): it equals
// served_quantity with no leftover, and scales by consumed_grams / served_grams when a group
// applies — so the Qté column stays consistent with the line's macros and the meal total.

function entry(over: Record<string, unknown> = {}): MealEntryModel {
  return {
    id: 'e1',
    mealId: 'm',
    kind: 'referenced',
    foodId: 'f',
    customName: null,
    servedQuantity: 500,
    unit: 'g',
    portionId: null,
    servedGrams: 500,
    snapKcal: 1000,
    snapFat: 0,
    snapCarb: 0,
    snapProtein: 0,
    orderIndex: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  } as unknown as MealEntryModel;
}

describe('mealEntryDto consumed.quantity (B-047)', () => {
  it('equals served_quantity when the line is in no leftover group', () => {
    const dto = mealEntryDto(entry({ servedQuantity: 200, servedGrams: 200 }));
    expect(dto.consumed.quantity).toBe(200);
    expect(dto.consumed.grams).toBe(200);
  });

  it('scales a grams line by consumed/served (canonical 500 g, net 100 / 1000 → 450)', () => {
    const ctx = new Map([['e1', { net: 100, servedTotal: 1000 }]]);
    const dto = mealEntryDto(entry({ servedQuantity: 500, servedGrams: 500 }), ctx);
    expect(dto.consumed.grams).toBe(450);
    expect(dto.consumed.quantity).toBe(450); // g unit: quantity tracks grams
  });

  it('scales a portion-unit line by the same ratio (2 portions × 0.9 → 1.8)', () => {
    const ctx = new Map([['e1', { net: 20, servedTotal: 200 }]]);
    const dto = mealEntryDto(
      entry({ unit: 'portion', portionId: 'p', servedQuantity: 2, servedGrams: 200 }),
      ctx,
    );
    expect(dto.consumed.grams).toBe(180); // 200 − 20×200/200
    expect(dto.consumed.quantity).toBeCloseTo(1.8, 10); // 2 × 180/200
  });
});
