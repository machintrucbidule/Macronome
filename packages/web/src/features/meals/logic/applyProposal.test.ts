import { describe, expect, it } from 'vitest';
import type { MealProposalItem } from '@macronome/shared';
import { proposalToEntryBody } from './applyProposal';

// AI meal-proposals S12 (B-123): the pure apply-mapping (§2.5). One certified proposal item →
// the referenced create body the existing POST /meals/:id/entries flow expects.
const SNAP = { kcal: 0, fat: 0, carb: 0, protein: 0 };

const portioned: MealProposalItem = {
  food_id: 'f-egg',
  food_name: 'Œufs',
  meal_id: 'm1',
  portion_id: 'po-egg',
  portion_label: 'œuf',
  served_quantity: 3,
  unit: 'portion',
  served_grams: 171,
  snap: SNAP,
  rating: 3,
};

const portionless: MealProposalItem = {
  food_id: 'f-chk',
  food_name: 'Blanc de poulet',
  meal_id: 'm1',
  portion_id: null,
  portion_label: null,
  served_quantity: 180,
  unit: 'g',
  served_grams: 180,
  snap: SNAP,
  rating: 3,
};

describe('proposalToEntryBody (S12 / B-123)', () => {
  it('maps a portioned item to a portion entry (count, not grams)', () => {
    expect(proposalToEntryBody(portioned)).toEqual({
      kind: 'referenced',
      food_id: 'f-egg',
      unit: 'portion',
      portion_id: 'po-egg',
      served_quantity: 3,
    });
  });

  it('maps a portionless item to a gram entry (no portion_id)', () => {
    expect(proposalToEntryBody(portionless)).toEqual({
      kind: 'referenced',
      food_id: 'f-chk',
      unit: 'g',
      served_quantity: 180,
    });
  });

  it('falls back to grams when a portion unit carries no portion_id', () => {
    const body = proposalToEntryBody({ ...portioned, portion_id: null });
    expect(body).toEqual({
      kind: 'referenced',
      food_id: 'f-egg',
      unit: 'g',
      served_quantity: 3,
    });
  });
});
