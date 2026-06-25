import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayDetail, Settings } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { SETTINGS_KEY } from '../../settings/useSettings';
import { MealsControls } from './MealsControls';

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
    current_mode: null,
    open_period_note: null,
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
        }
      : null,
  };
}

function renderControls(aiConfigured: boolean) {
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
