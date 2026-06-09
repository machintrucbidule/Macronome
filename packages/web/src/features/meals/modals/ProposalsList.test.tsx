import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { DayDetail, MealProposal } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { ProposalsList } from './ProposalsList';

// AI meal-proposals S10 (B-123): the read-only proposals display (mockup state 4). Every number
// shown is the server-certified value from the response (CLAUDE.md rule 2) — the test feeds the
// §2.4 worked-oracle proposals and asserts the rendering: indivisible portions (×3 / 1 dose),
// the certified day total, the per-axis chips, and the honest closest-fit gap wording.
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
  meals: [
    {
      id: 'm1',
      slot_name: 'Dîner',
      order_index: 0,
      entries: [],
      leftover_groups: [],
      totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
    },
    {
      id: 'm2',
      slot_name: 'Collation',
      order_index: 1,
      entries: [],
      leftover_groups: [],
      totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
    },
  ],
};

const SNAP = { kcal: 0, fat: 0, carb: 0, protein: 0 };

// P1 — full fit (Oracle-A shape): portioned ×3 + 1 dose + a portionless line; all targets met.
const P1: MealProposal = {
  id: 'p1',
  fit: 'full',
  items: [
    {
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
    },
    {
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
    },
    {
      food_id: 'f-whey',
      food_name: 'Whey',
      meal_id: 'm2',
      portion_id: 'po-dose',
      portion_label: 'dose',
      served_quantity: 1,
      unit: 'portion',
      served_grams: 30,
      snap: SNAP,
      rating: 3,
    },
  ],
  day_total: { kcal: 1614, fat: 52, carb: 85, protein: 170 },
  targets_met: { calorie: true, protein: true, fat: true, carb: true },
  gaps: [],
};

// P2 — closest fit (Oracle-D): fat floor short by 3 g; calorie in band; one unrated food.
const P2: MealProposal = {
  id: 'p2',
  fit: 'closest',
  items: [
    {
      food_id: 'f-beef',
      food_name: 'Bœuf haché 5%',
      meal_id: 'm1',
      portion_id: null,
      portion_label: null,
      served_quantity: 200,
      unit: 'g',
      served_grams: 200,
      snap: SNAP,
      rating: 3,
    },
    {
      food_id: 'f-salad',
      food_name: 'Salade',
      meal_id: 'm1',
      portion_id: null,
      portion_label: null,
      served_quantity: 100,
      unit: 'g',
      served_grams: 100,
      snap: SNAP,
      rating: null,
    },
  ],
  day_total: { kcal: 1585, fat: 47, carb: 105, protein: 175 },
  targets_met: { calorie: true, protein: true, fat: false, carb: true },
  gaps: [{ target: 'fat_floor', short_g: 3 }],
};

// RTL matcher for an element whose full (cross-child) text equals `txt` — for the quantity span
// that wraps a coloured "×3"/"1 dose" portion head plus a trailing grams text node.
const fullText =
  (txt: string) =>
  (_: string, el: Element | null): boolean =>
    el?.textContent === txt;

afterEach(() => {
  cleanup();
});

describe('ProposalsList — proposals display (S10 / B-123)', () => {
  it('renders a full-fit and a closest-fit proposal with certified numbers', () => {
    const { getByText, getAllByText } = render(
      <ProposalsList
        proposals={[P1, P2]}
        day={DAY}
        onRefine={vi.fn()}
        onChoose={vi.fn()}
        busy={false}
      />,
    );

    // titles + fit flags
    expect(getByText(i18n.t('meals.proposals.proposalTitle', { n: 1 }))).toBeTruthy();
    expect(getByText(i18n.t('meals.proposals.proposalTitle', { n: 2 }))).toBeTruthy();
    expect(getByText(i18n.t('meals.proposals.fit.full'))).toBeTruthy();
    expect(getByText(i18n.t('meals.proposals.fit.closest'))).toBeTruthy();

    // meals grouped per column (both proposals have a Dîner group)
    expect(getAllByText('Dîner').length).toBe(2);
    expect(getByText('Collation')).toBeTruthy();

    // indivisible portions + a portionless line
    expect(getByText(fullText('×3 · 171 g'))).toBeTruthy();
    expect(getByText(fullText('1 dose · 30 g'))).toBeTruthy();
    expect(getByText('180 g')).toBeTruthy();

    // certified day totals (kcal) — coloured in band, read from the response
    expect(getByText(i18n.t('meals.proposals.dayTotalKcal', { n: '1614' }))).toBeTruthy();
    expect(getByText(i18n.t('meals.proposals.dayTotalKcal', { n: '1585' }))).toBeTruthy();

    // P1 full fit: P/L chips "met"
    expect(getByText(i18n.t('meals.proposals.macroMet', { label: 'P', n: '170' }))).toBeTruthy();
    expect(getByText(i18n.t('meals.proposals.macroMet', { label: 'L', n: '52' }))).toBeTruthy();
  });

  it('shows the honest closest-fit gap (fat floor short by 3 g) and the unrated badge', () => {
    const { getByText } = render(
      <ProposalsList
        proposals={[P2]}
        day={DAY}
        onRefine={vi.fn()}
        onChoose={vi.fn()}
        busy={false}
      />,
    );

    // the L chip is a warning short-by-3 chip
    expect(
      getByText(i18n.t('meals.proposals.macroShort', { label: 'L', n: '47', short: '3' })),
    ).toBeTruthy();

    // the closest note is the exact, user-meaningful gap wording — no internal rationale
    expect(
      getByText(
        i18n.t('meals.proposals.gapFloor', {
          n: '3',
          macro: i18n.t('meals.proposals.gapMacro.fat'),
        }),
      ),
    ).toBeTruthy();

    // unrated food (D8) shows the "non noté" badge, not stars
    expect(getByText(i18n.t('meals.proposals.unrated'))).toBeTruthy();
  });
});
