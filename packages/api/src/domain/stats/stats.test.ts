import { expect, test } from 'vitest';
import { BEST_MONTH_MIN_DAYS, NOK_RUN_ALERT, STATS_ROLLING_WINDOWS } from '@macronome/shared';
import { bestMonth } from './best-month.js';
import { heatmap } from './heatmap.js';
import { monthlyPivot } from './monthly.js';
import { rolling } from './rolling.js';
import { signals } from './signals.js';
import { currentNokRun, currentOkStreak } from './streak.js';
import type { DayStat } from './util.js';

// Neutral oracles from spec/logic/stats-adherence.md (no personal data). Verdicts are the
// effective values; only logged days appear (not-logged days are filtered out upstream).

const d = (date: string, kcal: number, verdict: 'OK' | 'NOK'): DayStat => ({ date, kcal, verdict });

// §2 worked example: window 7, dates 27 May–2 Jun; 27 & 31 unlogged (absent).
const WINDOW7: DayStat[] = [
  d('2026-05-28', 1600, 'OK'),
  d('2026-05-29', 1700, 'NOK'),
  d('2026-05-30', 1500, 'NOK'),
  d('2026-06-01', 1620, 'OK'),
  d('2026-06-02', 1580, 'OK'),
];

test('rolling-7 averages over logged days, OK rate excludes the 2 unlogged (§2)', () => {
  const res = rolling(WINDOW7, STATS_ROLLING_WINDOWS, { cal_min: 1550, cal_max: 1650 });
  expect(res.as_of).toBe('2026-06-02');
  const w7 = res.windows.find((w) => w.window === 7)!;
  expect(w7.avg_kcal).toBe(1600); // (1600+1700+1500+1620+1580)/5
  expect(w7.ok_rate).toBe(3 / 5); // 0.6 — 27 & 31 excluded
  expect(w7.vs_target).toBe('in'); // 1600 within [1550, 1650]
});

test('rolling reports null figures when no day falls in the window', () => {
  const res = rolling([], STATS_ROLLING_WINDOWS, null);
  expect(res.as_of).toBeNull();
  expect(res.windows.every((w) => w.avg_kcal === null && w.ok_rate === null)).toBe(true);
});

test('current OK streak counts back from L, unlogged skipped, NOK breaks (§6)', () => {
  // Logged sequence (gaps at 06-29 and 07-02 are simply absent): …NOK, OK, OK, OK.
  const seq: DayStat[] = [
    d('2026-06-27', 1700, 'NOK'),
    d('2026-06-28', 1600, 'OK'),
    d('2026-06-30', 1620, 'OK'),
    d('2026-07-03', 1580, 'OK'),
  ];
  expect(currentOkStreak(seq)).toBe(3); // back to (but not past) the 06-27 NOK
  expect(currentNokRun(seq)).toBe(0); // latest day is OK
});

test('best month = highest ok_rate among months with ≥5 logged days, tie-break (§6)', () => {
  const logged: DayStat[] = [
    // April: 4 logged days (below the threshold) — ineligible even at 100% OK.
    ...['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04'].map((x) => d(x, 1600, 'OK')),
    // May: 5 logged, 4 OK → 0.8.
    d('2026-05-01', 1600, 'OK'),
    d('2026-05-02', 1600, 'OK'),
    d('2026-05-03', 1600, 'OK'),
    d('2026-05-04', 1600, 'OK'),
    d('2026-05-05', 1700, 'NOK'),
    // June: 5 logged, 4 OK → 0.8 (ties May on rate & days → more recent wins).
    d('2026-06-01', 1600, 'OK'),
    d('2026-06-02', 1600, 'OK'),
    d('2026-06-03', 1600, 'OK'),
    d('2026-06-04', 1600, 'OK'),
    d('2026-06-05', 1700, 'NOK'),
  ];
  const best = bestMonth(logged, BEST_MONTH_MIN_DAYS);
  expect(best).toEqual({ month: '2026-06', ok_rate: 0.8, logged_days: 5 });
});

test('best month is null when no month reaches the minimum logged days', () => {
  const logged = ['2026-05-01', '2026-05-02', '2026-05-03'].map((x) => d(x, 1600, 'OK'));
  expect(bestMonth(logged, BEST_MONTH_MIN_DAYS)).toBeNull();
});

test('monthly pivot splits counts + avg kcal over OK / NOK days (§4–5)', () => {
  const may: DayStat[] = [
    d('2026-05-01', 1600, 'OK'),
    d('2026-05-02', 1500, 'OK'),
    d('2026-05-03', 1800, 'NOK'),
  ];
  const [m] = monthlyPivot(may);
  expect(m).toMatchObject({
    month: 5,
    ok_count: 2,
    nok_count: 1,
    avg_kcal_ok: 1550,
    avg_kcal_nok: 1800,
  });
  expect(m!.ok_rate).toBe(2 / 3);
});

test('heatmap fills every calendar date of the year, none where not logged (§3)', () => {
  const cells = heatmap([d('2025-01-02', 1600, 'OK'), d('2025-12-31', 1700, 'NOK')], 2025);
  expect(cells).toHaveLength(365);
  expect(cells[0]).toEqual({ date: '2025-01-01', status: 'none' });
  expect(cells[1]).toEqual({ date: '2025-01-02', status: 'OK' });
  expect(cells[364]).toEqual({ date: '2025-12-31', status: 'NOK' });
});

test('signals: 30-day avg above band, NOK run ≥ alert, 14-day OK rate (§7)', () => {
  // Five most-recent logged days all NOK and above the band.
  const logged: DayStat[] = [
    d('2026-06-01', 2200, 'NOK'),
    d('2026-06-02', 2200, 'NOK'),
    d('2026-06-03', 2200, 'NOK'),
    d('2026-06-04', 2200, 'NOK'),
    d('2026-06-05', 2200, 'NOK'),
  ];
  const out = signals(logged, { cal_min: 1550, cal_max: 1650 }, NOK_RUN_ALERT);
  const byCode = Object.fromEntries(out.map((s) => [s.code, s.value]));
  expect(byCode.avg30_above_target).toBe(550); // 2200 − 1650
  expect(byCode.nok_run).toBe(5); // ≥ 3
  expect(byCode.ok_rate_14).toBe(0); // 0 OK of 5
});
