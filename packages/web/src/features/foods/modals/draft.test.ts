import { describe, expect, it } from 'vitest';
import type { ChronoFoodPrefill, FoodParseLabel } from '@macronome/shared';
import { chronoPatch, draftToBody, initialDraft, parsedPatch } from './draft';

// B-290: provenance is stamped by the reducer that built the draft, and only there. The two
// prefill paths must not be confused — a Chronodrive product is `chronodrive`, a pasted
// nutrition label is still typing and stays `manual`.
const prefill: ChronoFoodPrefill = {
  name: 'Panzani Spaghetti',
  comment: '500 g',
  kcal_per_100g: 361,
  fat_per_100g: 1.4,
  carb_per_100g: 72,
  protein_per_100g: 12,
};

const parsed: FoodParseLabel = { kcal_per_100g: 361, fat_per_100g: 1.4 };

describe('food draft provenance (B-290)', () => {
  it('starts a new draft as manual', () => {
    expect(initialDraft(null).source).toBe('manual');
    expect(draftToBody(initialDraft(null)).source).toBe('manual');
  });

  it('stamps a Chronodrive prefill as chronodrive', () => {
    expect(chronoPatch(prefill, '').source).toBe('chronodrive');
  });

  it('leaves the provenance alone when a nutrition label is parsed', () => {
    expect(parsedPatch(parsed)).not.toHaveProperty('source');
  });

  it('keeps the Chronodrive provenance through later edits of the same draft', () => {
    const draft = { ...initialDraft(null), ...chronoPatch(prefill, '') };
    const edited = { ...draft, ...parsedPatch(parsed), name: 'Spaghetti maison' };
    expect(draftToBody(edited).source).toBe('chronodrive');
  });
});
