import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayDetail, Settings } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { SETTINGS_KEY } from '../../settings/useSettings';
import { MealsProvider } from '../MealsContext';
import type { MealsController } from '../hooks/useMealsController';
import type { MealSelection } from '../hooks/useMealSelection';
import { MealsControls } from './MealsControls';

// A minimal selection stub so MealsControls (which reads useMeals().selection) can render outside
// the full controller. Overridable per test to drive the Σ toggle state + readout (B-207).
function stubSelection(over: Partial<MealSelection> = {}): MealSelection {
  return {
    mode: false,
    selected: new Set(),
    sum: { grams: 0, kcal: 0, fat: 0, carb: 0, protein: 0 },
    enter: vi.fn(),
    exit: vi.fn(),
    toggleMode: vi.fn(),
    toggle: vi.fn(),
    toggleMeal: vi.fn(),
    selectFromRow: vi.fn(),
    isSelected: () => false,
    allSelected: () => false,
    ...over,
  };
}

// AI meal-proposals S9 (B-123): the controls row drops the old `meals.hint` line and shows the
// ✨ Proposition IA button. The button is disabled with a Settings-link hint when the AI is not
// configured for the meal_suggestions task (D7).
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
  ],
};

function settings(aiConfigured: boolean): Settings {
  return {
    locale: 'fr',
    theme: 'dark',
    integrations: { home_assistant: null, barclaude_gateway: null },
    current_mode: null,
    open_period_note: null,
    lines_desktop: 20,
    lines_mobile: 15,
    ai: aiConfigured
      ? {
          provider: 'openai_compatible',
          base_url: 'https://x',
          api_key_set: true,
          tasks: {
            dish_photo_macros: { model: null, prompt: 'p' },
            meal_suggestions: { model: 'gpt', prompt: 'p' },
            advice: { model: null, prompt: 'p' },
          },
          avoidances: '',
        }
      : null,
  };
}

function renderControls(aiConfigured: boolean, selection: MealSelection = stubSelection()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(SETTINGS_KEY, { data: settings(aiConfigured) });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        null,
        createElement(
          MealsProvider,
          { value: { selection } as unknown as MealsController },
          createElement(MealsControls, {
            day: DAY,
            date: '2026-06-09',
            onClear: vi.fn(),
            onCopyYesterday: vi.fn(),
            onAddMeal: vi.fn(),
            undo: vi.fn(),
            redo: vi.fn(),
            canUndo: false,
            canRedo: false,
          }),
        ),
      ),
    ),
  );
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('MealsControls — Proposition IA button (S9 / B-123)', () => {
  it('replaces the hint with an enabled button when AI is configured', () => {
    const { getByRole, queryByText } = renderControls(true);
    const btn = getByRole('button', { name: new RegExp(i18n.t('meals.proposals.button')) });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(queryByText(/choisir l'aliment/i)).toBeNull();
    expect(queryByText(i18n.t('meals.proposals.notConfigured'))).toBeNull();
  });

  it('disables the button with a Settings-link hint when AI is not configured', () => {
    const { getByRole, getByText } = renderControls(false);
    const btn = getByRole('button', { name: new RegExp(i18n.t('meals.proposals.button')) });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    const link = getByRole('link', { name: i18n.t('meals.proposals.configureLink') });
    expect(link.getAttribute('href')).toBe('/parametres');
    expect(getByText(new RegExp(i18n.t('meals.proposals.notConfigured')))).toBeTruthy();
  });
});

describe('MealsControls — selection sum Σ (B-207)', () => {
  const sumBtn = (r: ReturnType<typeof renderControls>) =>
    r.getByRole('button', { name: i18n.t('meals.sum.toggle') }) as HTMLButtonElement;

  it('the Σ toggle is not pressed and shows no readout out of selection mode', () => {
    const r = renderControls(true);
    expect(sumBtn(r).getAttribute('aria-pressed')).toBe('false');
    expect(r.queryByText(i18n.t('meals.sum.empty'))).toBeNull();
  });

  it('clicking the Σ toggle enters selection mode (toggleMode)', () => {
    const selection = stubSelection();
    const r = renderControls(true, selection);
    fireEvent.click(sumBtn(r));
    expect(selection.toggleMode).toHaveBeenCalledTimes(1);
  });

  it('in selection mode the toggle is pressed and an empty selection shows the hint', () => {
    const r = renderControls(true, stubSelection({ mode: true }));
    expect(sumBtn(r).getAttribute('aria-pressed')).toBe('true');
    expect(r.getByText(i18n.t('meals.sum.empty'))).toBeTruthy();
  });

  it('renders the summed grams/kcal/macros while a selection is held', () => {
    const r = renderControls(
      true,
      stubSelection({
        mode: true,
        selected: new Set(['e1', 'e3']),
        sum: { grams: 300, kcal: 500, fat: 22, carb: 60, protein: 40 },
      }),
    );
    // Σ readout mirrors the footer figures (grams · kcal · L · G · P), each via r0.
    for (const n of ['300', '500', '22', '60', '40']) {
      expect(r.getByText(new RegExp(`\\b${n}\\b`))).toBeTruthy();
    }
    expect(r.queryByText(i18n.t('meals.sum.empty'))).toBeNull();
  });
});
