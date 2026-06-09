import { createElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DayDetail, MealProposal } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { RefinePanel } from './RefinePanel';
import type { ExcludedFood, PinnedLine } from '../logic/refineConstraints';

// RF-1 / B-136: the pinned quantity in the Raffiner popup is editable by direct entry (not only the
// − / + stepper). Typing a value pins the line at that quantity (clamped like stepping); the stepper
// then steps from the typed value.
const DAY: DayDetail = {
  date: '2026-06-09',
  kind: 'detailed',
  activity_level: 'sedentary',
  comment: null,
  verdict_auto: null,
  verdict_override: null,
  effective_verdict: null,
  target_snapshot: {
    cal_min: 1550,
    cal_max: 1650,
    protein_floor_g: 140,
    fat_floor_g: 50,
    carb_ceiling_g: 150,
  },
  totals: { kcal: 920, fat: 28, carb: 70, protein: 78, weight_g: 0 },
  constat: {
    estimated_burn: null,
    deficit: null,
    kg_per_week: null,
    per_level_activity_burn: null,
  },
  meals: [],
};

const PROPOSAL: MealProposal = {
  id: 'p1',
  fit: 'full',
  items: [
    {
      food_id: 'f-chk',
      food_name: 'Blanc de poulet',
      meal_id: 'm1',
      portion_id: null,
      portion_label: null,
      served_quantity: 180,
      unit: 'g',
      served_grams: 180,
      snap: { kcal: 0, fat: 0, carb: 0, protein: 0 },
      rating: 3,
    },
  ],
  day_total: { kcal: 0, fat: 0, carb: 0, protein: 0 },
  targets_met: { calorie: true, protein: true, fat: true, carb: true },
  gaps: [],
};

function Harness() {
  const [pinned, setPinned] = useState<PinnedLine[]>([]);
  const [excluded, setExcluded] = useState<ExcludedFood[]>([]);
  return createElement(RefinePanel, {
    proposal: PROPOSAL,
    day: DAY,
    excluded,
    setExcluded,
    pinned,
    setPinned,
    note: '',
    onNoteChange: vi.fn(),
  });
}

const qtyInput = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>(i18n.t('meals.proposals.refine.qtyLabel'));

afterEach(() => {
  cleanup();
});

describe('RefinePanel — direct quantity entry (RF-1 / B-136)', () => {
  it('typing a quantity pins the line at that value', () => {
    render(<Harness />);
    expect(qtyInput().value).toBe('180'); // seeded from the proposed quantity
    expect(screen.getByText(i18n.t('meals.proposals.refine.constraintsEmpty'))).toBeTruthy();

    fireEvent.change(qtyInput(), { target: { value: '250' } });
    fireEvent.blur(qtyInput());

    expect(screen.getByText(i18n.t('meals.proposals.refine.fixe'))).toBeTruthy(); // a pin chip exists
    expect(qtyInput().value).toBe('250');
  });

  it('the − stepper still steps from the typed value', () => {
    render(<Harness />);
    fireEvent.change(qtyInput(), { target: { value: '250' } });
    fireEvent.blur(qtyInput());

    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(qtyInput().value).toBe('245'); // 250 − 5 g step
  });
});
