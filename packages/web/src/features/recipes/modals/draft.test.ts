import { describe, expect, it } from 'vitest';
import type { RecipeFull } from '@macronome/shared';
import { draftToBody, draftToPreviewBody, emptyRecipeDraft, initialRecipeDraft } from './draft';

// RW-1/B-137: the draft carries the persisted "Poids auto" state; the request bodies
// send the flag and omit total_batch_grams while auto (the server resolves Σ).

const full: RecipeFull = {
  id: '00000000-0000-4000-8000-000000000001',
  owner_id: '00000000-0000-4000-8000-000000000002',
  name: 'Sample bake',
  kcal_per_100g: 100,
  fat_per_100g: 2,
  carb_per_100g: 5,
  protein_per_100g: 10,
  total_batch_grams: 600,
  batch_weight_auto: true,
  servings: 4,
  weight_per_portion_g: 150,
  rating: null,
  derived_food_id: null,
  archived_at: null,
  instructions: null,
  total_ingredient_grams: 600,
  per_portion: { kcal: 160, fat: 3.25, carb: 24.5, protein: 7 },
  ingredients: [],
};

describe('recipe draft — "Poids auto" (RW-1/B-137)', () => {
  it('a new draft starts auto; loading a recipe picks up its persisted flag', () => {
    expect(emptyRecipeDraft().batchAuto).toBe(true);
    expect(initialRecipeDraft(full).batchAuto).toBe(true);
    expect(initialRecipeDraft({ ...full, batch_weight_auto: false }).batchAuto).toBe(false);
  });

  it('auto draft: bodies send the flag and omit total_batch_grams', () => {
    const draft = { ...initialRecipeDraft(full), name: 'x' };
    const body = draftToBody(draft);
    expect(body.batch_weight_auto).toBe(true);
    expect(body).not.toHaveProperty('total_batch_grams');
    expect(draftToPreviewBody(draft)).not.toHaveProperty('total_batch_grams');
  });

  it('manual draft: bodies send the flag off and the typed weight', () => {
    const draft = { ...initialRecipeDraft(full), batchAuto: false, batch: '900' };
    const body = draftToBody(draft);
    expect(body.batch_weight_auto).toBe(false);
    expect(body.total_batch_grams).toBe(900);
    expect(draftToPreviewBody(draft).total_batch_grams).toBe(900);
  });
});
