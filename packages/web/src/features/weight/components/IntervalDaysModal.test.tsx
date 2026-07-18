import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { IntervalDaysResponse } from '@macronome/shared';
import i18n from '../../../i18n/config';
import styles from './interval-days.module.css';

// B-227: the redesigned interval-days popup lists every day with a readable date, coloured macros,
// a per-day verdict band and a reserved (uniform-height) comment slot; a recap header shows the
// average + the interval's weight change; a day click navigates to /day/:date. Data is mocked so
// this stays a render/interaction check (the endpoint is covered by an api integration test).
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

const intervalDaysMock = vi.fn<(start: string, end: string) => unknown>();
vi.mock('../useWeight', () => ({
  useIntervalDays: (start: string, end: string): unknown => intervalDaysMock(start, end),
}));

import { IntervalDaysModal } from './IntervalDaysModal';

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Dates in 2020 so `isToday` is deterministically false; 2020-01-06 is a Monday (not a weekend).
const response = (): IntervalDaysResponse => ({
  data: [
    {
      date: '2020-01-06',
      kcal: 2000,
      macros: { L: 70, G: 200, P: 120 },
      comment: 'trop de sel',
      state: 'ok',
    },
    { date: '2020-01-07', kcal: null, macros: null, comment: null, state: 'none' },
  ],
  summary: { day_count: 2, logged_count: 1, avg_kcal: 2000 },
});

function renderModal(onClose = vi.fn()) {
  intervalDaysMock.mockReturnValue({ data: response(), isLoading: false });
  const utils = render(
    <IntervalDaysModal
      start="2020-01-06"
      end="2020-01-07"
      weightEnd={79.2}
      delta={-0.8}
      onClose={onClose}
    />,
  );
  return { ...utils, onClose };
}

// The shared Modal portals its content to <body>, so query document.body (not the render container).
describe('IntervalDaysModal (B-227)', () => {
  it('renders human-readable dates (weekday + month), not the raw ISO string', () => {
    const { getByText } = renderModal();
    expect(getByText(/6 janvier 2020/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('2020-01-06');
  });

  it('colour-codes the macros with the L/G/P classes', () => {
    renderModal();
    expect(document.body.querySelector(`.${styles.mFat}`)?.textContent).toContain('70');
    expect(document.body.querySelector(`.${styles.mCarb}`)?.textContent).toContain('200');
    expect(document.body.querySelector(`.${styles.mProt}`)?.textContent).toContain('120');
  });

  it('reserves the comment slot on EVERY day so cards keep a uniform height', () => {
    renderModal();
    // Two days, one with a comment and one without → still two comment elements (the empty one
    // reserves the same height). This is the fix for the uneven-card-height complaint.
    expect(document.body.querySelectorAll(`.${styles.comment}`)).toHaveLength(2);
  });

  it('applies the per-day verdict state band (ok vs none)', () => {
    renderModal();
    expect(document.body.querySelector(`.${styles.stOk}`)).not.toBeNull();
    expect(document.body.querySelector(`.${styles.stNone}`)).not.toBeNull();
  });

  it('shows the recap header: average kcal and the interval weight change', () => {
    renderModal();
    expect(document.body.textContent).toContain('moy.');
    expect(document.body.textContent).toContain('2000');
    // start = weight_end − Δ = 79.2 − (−0.8) = 80.0 → "80,0 → 79,2 kg"
    expect(document.body.textContent).toContain('80,0');
    expect(document.body.textContent).toContain('79,2');
  });

  it('navigates to the day and closes on a day click', () => {
    const { getAllByRole, onClose } = renderModal();
    fireEvent.click(getAllByRole('button')[0] as HTMLElement);
    expect(navigateMock).toHaveBeenCalledWith('/day/2020-01-06');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
