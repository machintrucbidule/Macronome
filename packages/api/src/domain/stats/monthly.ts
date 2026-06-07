import type { MonthlyStat } from '@macronome/shared';
import { mean, type DayStat } from './util.js';

// Monthly pivot (spec/logic/stats-adherence.md §4–5): per month of the selected year,
// OK/NOK counts + rate, and the avg-kcal split over OK vs NOK days. One array feeds both
// the OK/NOK stacked bars and the avg-calories grouped bars. Only months with data.

/** Group `loggedOfYear` by calendar month → one MonthlyStat each, ascending by month. */
export function monthlyPivot(loggedOfYear: DayStat[]): MonthlyStat[] {
  const byMonth = new Map<number, DayStat[]>();
  for (const s of loggedOfYear) {
    const month = Number(s.date.slice(5, 7));
    const list = byMonth.get(month);
    if (list) list.push(s);
    else byMonth.set(month, [s]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, days]) => {
      const ok = days.filter((d) => d.verdict === 'OK');
      const nok = days.filter((d) => d.verdict === 'NOK');
      return {
        month,
        ok_count: ok.length,
        nok_count: nok.length,
        ok_rate: ok.length / days.length,
        avg_kcal_ok: mean(ok.map((d) => d.kcal)),
        avg_kcal_nok: mean(nok.map((d) => d.kcal)),
        avg_kcal_global: mean(days.map((d) => d.kcal))!, // days is non-empty for a present month
      };
    });
}
