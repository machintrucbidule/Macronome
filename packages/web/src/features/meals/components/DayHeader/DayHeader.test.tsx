import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayDetail } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { journalApi } from '../../../../api/journal';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import styles from '../../meals.module.css';
import { DayHeader } from './DayHeader';

// B-063/B-064: the editable day comment and the OK/NOK badge render on the header's date line.
// The totals row is stubbed — only the date-line content is under test here.
vi.mock('../TotalsRow/TotalsRow', () => ({ TotalsRow: () => null }));
vi.mock('../../../../lib/useIsMobile', () => ({ useIsMobile: vi.fn(() => false) }));

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
  constat: {
    estimated_burn: null,
    deficit: null,
    kg_per_week: null,
    per_level_activity_burn: null,
  },
} as unknown as DayDetail;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function renderHeader(onNavigate: (date: string) => void = vi.fn()) {
  const ctrl = {
    actions: { setComment: vi.fn(), setVerdict: vi.fn() },
  } as unknown as MealsController;
  return render(
    <MealsProvider value={ctrl}>
      <DayHeader date={DAY.date} day={DAY} onNavigate={onNavigate} />
    </MealsProvider>,
    { wrapper },
  );
}

const dateLabel = (): HTMLElement => screen.getByRole('button', { name: /2026/ });
const calendarOpen = (c: HTMLElement): boolean => c.querySelector(`.${styles.cal}`) !== null;
/** One horizontal touch drag past the 48 px swipe threshold. */
function swipe(el: HTMLElement, dx: number): void {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 40 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 42 }] });
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

// B-297: the date text is a second trigger for the calendar, alongside the ▦ button.
describe('DayHeader — the date label opens the calendar (B-297)', () => {
  it('opens the popover on click and closes it on a second click', () => {
    vi.spyOn(journalApi, 'list').mockResolvedValue({ data: [] } as never);
    const { container } = renderHeader();
    expect(calendarOpen(container.ownerDocument.body)).toBe(false);
    expect(dateLabel().getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(dateLabel());
    expect(calendarOpen(container.ownerDocument.body)).toBe(true);
    expect(dateLabel().getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(dateLabel());
    expect(calendarOpen(container.ownerDocument.body)).toBe(false);
  });

  it('opens the popover from the keyboard (Enter)', () => {
    vi.spyOn(journalApi, 'list').mockResolvedValue({ data: [] } as never);
    const { container } = renderHeader();

    fireEvent.keyDown(dateLabel(), { key: 'Enter' });
    expect(calendarOpen(container.ownerDocument.body)).toBe(true);
  });

  it('still lets a mobile swipe over the label change the day, without opening the calendar', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    vi.spyOn(journalApi, 'list').mockResolvedValue({ data: [] } as never);
    const onNavigate = vi.fn();
    const { container } = renderHeader(onNavigate);

    // Swipe left = next day; the browser then synthesizes a click where the finger lifted.
    swipe(dateLabel(), -120);
    fireEvent.click(dateLabel());

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('2026-06-08');
    expect(calendarOpen(container.ownerDocument.body)).toBe(false);
  });
});
