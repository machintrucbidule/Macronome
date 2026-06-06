import type { Signal, TargetZone } from '@macronome/shared';
import { windowStats } from './rolling.js';
import { currentNokRun } from './streak.js';
import { latestDate, type DayStat } from './util.js';

// Factual, rule-based signals (spec/logic/stats-adherence.md §7). No motivational copy.
// `value` carries the display number; `text` is the contract's English fallback (the web
// localizes via stats.signal.<code>). Thresholds are named constants (passed in by the
// service). Computed as of the latest logged day L.

/** 30-day avg vs the band, current NOK run (alerted / cleared), and the 14-day OK rate.
 * Each signal carries a server-decided `status` for the design's status dot (rule 2). */
export function signals(
  logged: DayStat[],
  zone: TargetZone | null,
  nokRunAlert: number,
  okRateGood: number,
): Signal[] {
  const anchor = latestDate(logged);
  if (anchor === null) return [];
  const out: Signal[] = [];

  const avg30 = windowStats(logged, anchor, 30).avg;
  if (zone !== null && avg30 !== null) {
    if (avg30 > zone.cal_max) {
      const value = Math.round(avg30 - zone.cal_max);
      out.push({
        code: 'avg30_above_target',
        value,
        status: 'warn',
        text: `30-day average ${value} kcal above target`,
      });
    } else if (avg30 < zone.cal_min) {
      const value = Math.round(zone.cal_min - avg30);
      out.push({
        code: 'avg30_below_target',
        value,
        status: 'info',
        text: `30-day average ${value} kcal below target`,
      });
    }
  }

  const nokRun = currentNokRun(logged);
  if (nokRun >= nokRunAlert) {
    out.push({
      code: 'nok_run',
      value: nokRun,
      status: 'warn',
      text: `${nokRun} consecutive days off target`,
    });
  } else {
    out.push({
      code: 'nok_run_clear',
      value: nokRun,
      status: 'ok',
      text: 'No NOK streak in progress',
    });
  }

  const okRate14 = windowStats(logged, anchor, 14).ok_rate;
  if (okRate14 !== null) {
    const value = Math.round(okRate14 * 100);
    out.push({
      code: 'ok_rate_14',
      value,
      status: value >= okRateGood ? 'ok' : 'warn',
      text: `14-day OK rate ${value}%`,
    });
  }

  return out;
}
