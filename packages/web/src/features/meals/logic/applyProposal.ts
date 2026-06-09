import type { CreateMealEntryRequest, MealProposalItem } from '@macronome/shared';

// Pure apply-mapping (B-123 / Slice 12, spec §2.5): turn one certified proposal item into the
// referenced meal-entry create body the existing POST /meals/:id/entries flow expects. The server
// re-snapshots macros at write time from the same stored per-100 g values the solver used, so the
// stored snapshot matches the proposal `snap` (calorie-basis rule — no drift). No nutrition is
// computed here.
export function proposalToEntryBody(item: MealProposalItem): CreateMealEntryRequest {
  if (item.unit === 'portion' && item.portion_id) {
    return {
      kind: 'referenced',
      food_id: item.food_id,
      unit: 'portion',
      portion_id: item.portion_id,
      served_quantity: item.served_quantity,
    };
  }
  return {
    kind: 'referenced',
    food_id: item.food_id,
    unit: 'g',
    served_quantity: item.served_quantity,
  };
}
