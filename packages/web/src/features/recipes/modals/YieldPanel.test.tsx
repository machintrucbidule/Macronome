import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { RecipePreview } from '@macronome/shared';
import '../../../i18n/config';
import { YieldPanel } from './YieldPanel';

// B-051: while untouched, "Poids du lot" tracks the live ingredient sum (the only number
// input / spinbutton in the panel — the servings stepper is a button cluster). Once the
// user types a value the field holds it; "réinitialiser" (onBatch('')) returns to tracking.
afterEach(() => cleanup());

const preview: RecipePreview = {
  total_ingredient_grams: 791,
  total_batch_grams: 791,
  servings: 4,
  kcal_per_100g: 100,
  fat_per_100g: 2,
  carb_per_100g: 5,
  protein_per_100g: 10,
  weight_per_portion_g: 197.75,
  total_macros: { kcal: 791, fat: 16, carb: 40, protein: 79 },
  per_portion: { kcal: 198, fat: 4, carb: 10, protein: 20 },
  ingredients: [],
};

function renderPanel(batch: string) {
  return render(
    <YieldPanel
      servings="4"
      batch={batch}
      preview={preview}
      onServings={vi.fn()}
      onBatch={vi.fn()}
    />,
  );
}

describe('YieldPanel — batch weight tracks the ingredient sum (B-051)', () => {
  it('shows the live ingredient sum while the batch field is untouched', () => {
    renderPanel('');
    expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe('791');
  });

  it('holds the entered value once the batch field is edited', () => {
    renderPanel('500');
    expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe('500');
  });
});
