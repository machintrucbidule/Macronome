import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RecipePreview } from '@macronome/shared';
import '../../../i18n/config';
import { YieldPanel } from './YieldPanel';

// RW-1/B-137 (supersedes the B-051 `batch===''` proxy): the persisted "Poids auto"
// toggle governs the batch field — ON ⇒ disabled field mirroring the live ingredient
// sum; OFF ⇒ editable field holding the user's value. Switching to manual seeds the
// field with the value displayed at the switch.
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

function renderPanel(batch: string, batchAuto: boolean) {
  const onBatch = vi.fn();
  const onBatchAuto = vi.fn();
  render(
    <YieldPanel
      servings="4"
      batch={batch}
      batchAuto={batchAuto}
      preview={preview}
      onServings={vi.fn()}
      onBatch={onBatch}
      onBatchAuto={onBatchAuto}
    />,
  );
  return { onBatch, onBatchAuto };
}

const batchInput = () => screen.getByRole<HTMLInputElement>('spinbutton');

describe('YieldPanel — "Poids auto" toggle (RW-1/B-137)', () => {
  it('auto: the batch field is disabled and mirrors the live ingredient sum', () => {
    renderPanel('500', true); // a stale manual value must not show while auto
    expect(batchInput().value).toBe('791');
    expect(batchInput().disabled).toBe(true);
  });

  it('manual: the batch field is enabled and holds the entered value', () => {
    renderPanel('500', false);
    expect(batchInput().value).toBe('500');
    expect(batchInput().disabled).toBe(false);
  });

  it('switching to manual seeds the field with the displayed sum', () => {
    const { onBatch, onBatchAuto } = renderPanel('', true);
    fireEvent.click(screen.getByRole('button', { name: 'Manuel' }));
    expect(onBatch).toHaveBeenCalledWith('791');
    expect(onBatchAuto).toHaveBeenCalledWith(false);
  });

  it('switching back to auto only flips the flag (the sum takes over the display)', () => {
    const { onBatch, onBatchAuto } = renderPanel('500', false);
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(onBatchAuto).toHaveBeenCalledWith(true);
    expect(onBatch).not.toHaveBeenCalled();
  });
});
