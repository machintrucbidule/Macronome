import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DayDetail } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { DayHeader } from './DayHeader';

// B-063/B-064: the editable day comment and the OK/NOK badge render on the header's date line.
// The totals row is stubbed — only the date-line content is under test here.
vi.mock('../TotalsRow/TotalsRow', () => ({ TotalsRow: () => null }));

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

const DAY = {
  date: '2026-06-07',
  kind: 'detailed',
  comment: 'Concert',
  verdict_auto: 'OK',
  verdict_override: null,
  effective_verdict: 'OK',
  totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
} as unknown as DayDetail;

function renderHeader() {
  const ctrl = {
    actions: { setComment: vi.fn(), setVerdict: vi.fn() },
  } as unknown as MealsController;
  return render(
    <MealsProvider value={ctrl}>
      <DayHeader date={DAY.date} day={DAY} onNavigate={vi.fn()} />
    </MealsProvider>,
  );
}

describe('DayHeader date line (B-063/B-064)', () => {
  it('renders the day comment field with its current value', () => {
    renderHeader();
    expect(screen.getByDisplayValue('Concert')).toBeTruthy();
    expect(screen.getByPlaceholderText(i18n.t('meals.commentPlaceholder'))).toBeTruthy();
  });

  it('renders the OK/NOK verdict badge on the date line', () => {
    const { container } = renderHeader();
    expect(screen.getByText('OK')).toBeTruthy();
    expect(container.textContent).toContain(i18n.t('meals.verdict.auto'));
  });
});
