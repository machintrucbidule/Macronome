import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayDetail } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { MealsProvider } from '../MealsContext';
import type { MealsController } from '../hooks/useMealsController';
import { MealsControls } from './MealsControls';
import { CopyYesterdayConfirm } from './CopyYesterdayConfirm';

// CP-1 / B-082: "Copier hier" sits in the controls row and replaces the day with a copy of
// yesterday behind a strong confirm. These cover the button wiring + the confirm modal.
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

// MealsControls reads useMeals().selection (B-207) — provide a minimal selection stub.
const selectionStub = {
  mode: false,
  selected: new Set<string>(),
  sum: { grams: 0, kcal: 0, fat: 0, carb: 0, protein: 0 },
  toggleMode: vi.fn(),
  isSelected: () => false,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return createElement(
    QueryClientProvider,
    { client },
    createElement(
      MemoryRouter,
      null,
      createElement(
        MealsProvider,
        { value: { selection: selectionStub } as unknown as MealsController },
        children,
      ),
    ),
  );
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('Copier hier (B-082)', () => {
  it('renders the button and fires onCopyYesterday on click', () => {
    const onCopyYesterday = vi.fn();
    render(
      <MealsControls
        day={DAY}
        date="2026-06-09"
        onClear={vi.fn()}
        onCopyYesterday={onCopyYesterday}
        onAddMeal={vi.fn()}
        undo={vi.fn()}
        redo={vi.fn()}
        canUndo={false}
        canRedo={false}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.copyYesterday') }));
    expect(onCopyYesterday).toHaveBeenCalledTimes(1);
  });

  it('confirm modal confirms and cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<CopyYesterdayConfirm onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(i18n.t('meals.copy.prompt'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.copy.confirm') }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(<CopyYesterdayConfirm onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
