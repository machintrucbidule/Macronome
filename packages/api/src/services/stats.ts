import {
  BEST_MONTH_MIN_DAYS,
  NOK_RUN_ALERT,
  STATS_ROLLING_WINDOWS,
  type AdherenceResponse,
  type RollingResponse,
  type TargetZone,
} from '@macronome/shared';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
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

/** GET /stats/rolling — 7/14/30/365 windows as of the latest logged day. */
export async function getRolling(userId: string): Promise<RollingResponse> {
  const [aggregates, zone] = await Promise.all([dayReadRepo.readAll(userId), currentZone(userId)]);
  return rolling(toDayStats(aggregates), STATS_ROLLING_WINDOWS, zone);
}

/** GET /stats/adherence?year=YYYY — heatmap + monthly pivots + key figures + signals. */
export async function getAdherence(userId: string, year: number): Promise<AdherenceResponse> {
  const [aggregates, zone] = await Promise.all([dayReadRepo.readAll(userId), currentZone(userId)]);
  const logged = toDayStats(aggregates);
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
