import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { IntervalDaysResponse } from '@macronome/shared';
import '../../../i18n/config';

// B-225: the interval-days recap popup lists every day of the period's interval and, on a day
// click, navigates to that day's Repas screen (/day/:date). We mock the data hook + router so the
// test stays a pure render/interaction check (the endpoint is covered by an api integration test).
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

const intervalDaysMock = vi.fn<(start: string, end: string) => unknown>();
vi.mock('../useWeight', () => ({
  useIntervalDays: (start: string, end: string): unknown => intervalDaysMock(start, end),
}));

import { IntervalDaysModal } from './IntervalDaysModal';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const response = (): IntervalDaysResponse => ({
  data: [
    { date: '2026-01-01', kcal: 2000, macros: { L: 70, G: 200, P: 120 }, comment: 'trop de sel' },
    { date: '2026-01-02', kcal: null, macros: null, comment: null },
  ],
});

describe('IntervalDaysModal (B-225)', () => {
  it('lists every day of the interval, with the comment when present', () => {
    intervalDaysMock.mockReturnValue({ data: response(), isLoading: false });
    const { getByText } = render(
      <IntervalDaysModal start="2026-01-01" end="2026-01-02" onClose={vi.fn()} />,
    );
    expect(getByText('2026-01-01')).toBeTruthy();
    expect(getByText('2026-01-02')).toBeTruthy();
    expect(getByText('trop de sel')).toBeTruthy(); // full comment shown
  });

  it('navigates to the day and closes on a day click', () => {
    intervalDaysMock.mockReturnValue({ data: response(), isLoading: false });
    const onClose = vi.fn();
    const { getByText } = render(
      <IntervalDaysModal start="2026-01-01" end="2026-01-02" onClose={onClose} />,
    );
    fireEvent.click(getByText('2026-01-02'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/day/2026-01-02');
  });

  it('passes the interval bounds to the data hook', () => {
    intervalDaysMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<IntervalDaysModal start="2026-03-01" end="2026-03-10" onClose={vi.fn()} />);
    expect(intervalDaysMock).toHaveBeenCalledWith('2026-03-01', '2026-03-10');
  });
});
