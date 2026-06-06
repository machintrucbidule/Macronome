import {
  BEST_MONTH_MIN_DAYS,
  NOK_RUN_ALERT,
  STATS_ROLLING_WINDOWS,
  type AdherenceResponse,
  type RollingResponse,
  type TargetZone,
} from '@macronome/shared';
import { dayStatRepo, type DateRange } from '../data/repositories/day-stat.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import {
  bestMonth,
  currentOkStreak,
  heatmap,
  monthlyPivot,
  okRate,
  rolling,
  signals,
  type DayStat,
} from '../domain/stats/index.js';
import { toDayStats } from './day-stat.js';
import { todayString } from './day-context.js';
import { toDate } from '../data/repositories/day-read.repo.js';

// Stats service (spec/api §Stats): reads the frozen day history, maps it to logged-only
// DayStat[] (day-stat.ts), then delegates every figure to the pure domain. The web only
// renders. The current calorie band is the target in effect today (shading + vs-target).

const num = (d: { toString(): string }): number => Number(d.toString());

/** The calorie band in effect today, or null when no target exists yet. */
async function currentZone(userId: string): Promise<TargetZone | null> {
  const target = await targetRepo.currentAsOf(userId, new Date());
  if (!target) return null;
  return { cal_min: num(target.calorieMin), cal_max: num(target.calorieMax) };
}

// Rolling only looks back the widest window from the latest logged day, so the read is
// narrowed to that trailing range (+1 day margin) instead of the full history (M9d perf).
const ROLLING_LOOKBACK_DAYS = Math.max(...STATS_ROLLING_WINDOWS) + 1;

/** Trailing [latest − lookback, latest] range covering every rolling window. */
function rollingRange(latest: Date): DateRange {
  const from = new Date(latest);
  from.setUTCDate(from.getUTCDate() - ROLLING_LOOKBACK_DAYS);
  return { from, to: latest };
}

/** GET /stats/rolling — 7/14/30/365 windows as of the latest logged day. */
export async function getRolling(userId: string): Promise<RollingResponse> {
  // Future planned days (date > today) are excluded from stats until they arrive
  // (stats-adherence.md §1): clamp the anchor and the read range to today, then drop
  // any future day so the internal rolling anchor (latest logged) stays ≤ today.
  const today = todayString();
  const latestRaw = await dayStatRepo.latestDate(userId);
  const cap = toDate(today);
  const latest = latestRaw && latestRaw > cap ? cap : latestRaw;
  const [days, zone] = await Promise.all([
    dayStatRepo.readLightweight(userId, latest ? rollingRange(latest) : undefined),
    currentZone(userId),
  ]);
  const logged = toDayStats(days).filter((s) => s.date <= today);
  return rolling(logged, STATS_ROLLING_WINDOWS, zone);
}

/** GET /stats/adherence?year=YYYY — heatmap + monthly pivots + key figures + signals.
 * Needs full history (overall ok-rate, best month), read lightweight (M9d perf). */
export async function getAdherence(userId: string, year: number): Promise<AdherenceResponse> {
  const [days, zone] = await Promise.all([
    dayStatRepo.readLightweight(userId),
    currentZone(userId),
  ]);
  // Future planned days (date > today) are excluded from every aggregate until they
  // arrive (stats-adherence.md §1) — filtering here covers ok-rate, streak, best month,
  // heatmap, pivots and signals, which all derive from this array.
  const logged = toDayStats(days).filter((s) => s.date <= todayString());
  const inYear = (s: DayStat): boolean => s.date.startsWith(`${year}-`);
  const yearLogged = logged.filter(inYear);
  return {
    heatmap: heatmap(yearLogged, year),
    monthly: monthlyPivot(yearLogged),
    key: {
      year_ok_rate: okRate(yearLogged),
      overall_ok_rate: okRate(logged),
      current_ok_streak: currentOkStreak(logged),
      best_month: bestMonth(logged, BEST_MONTH_MIN_DAYS),
    },
    target_zone: zone,
    signals: signals(logged, zone, NOK_RUN_ALERT),
  };
}
