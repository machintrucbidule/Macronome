import { describe, expect, it } from 'vitest';
import type { DishPhotoMacros } from '@macronome/shared';
import { macrosToCustomValues } from './imagePick';

// QP-1/B-158: the AI dish-photo estimate maps 1:1 to the custom-entry form values (the same mapping
// as CustomFoodModal.applyAnalysis). A 0 served weight collapses to null (optional served weight).
const base: DishPhotoMacros = {
  detected: true,
  dish_name: 'Pasta',
  kcal: 620,
  weight_g: 350,
  fat_g: 18,
  carb_g: 80,
  protein_g: 24,
};

describe('macrosToCustomValues', () => {
  it('maps the six fields 1:1', () => {
    expect(macrosToCustomValues(base)).toEqual({
      name: 'Pasta',
      kcal: 620,
      servedGrams: 350,
      snap: { kcal: 620, fat: 18, carb: 80, protein: 24 },
    });
  });

  it('maps a 0 served weight to null', () => {
    expect(macrosToCustomValues({ ...base, weight_g: 0 }).servedGrams).toBeNull();
  });
});
