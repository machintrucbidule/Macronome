import {
  BEST_MONTH_MIN_DAYS,
  NOK_RUN_ALERT,
  OK_RATE_GOOD_PCT,
  STATS_ROLLING_WINDOWS,
  type AdherenceResponse,
  type RollingResponse,
  type TargetZone,
} from '@macronome/shared';
import { dayStatRepo, type DateRange } from '../data/repositories/day-stat.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import { weightRepo } from '../data/repositories/weight.repo.js';
import {
  bestMonth,
  currentOkStreak,
  heatmap,
  monthlyPivot,
  okRate,
  rolling,
  signals,
  weightRecords,
  type TargetBand,
} from '../domain/stats/index.js';
import { toDayStats } from './day-stat.js';
import { loadBurnContext } from './journal-burn.js';
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

/** The user's full target history reduced to effective date + calorie band (CZ-1/B-141):
 * lets the domain resolve each month's shaded band from the target that applied then. */
async function targetBands(userId: string): Promise<TargetBand[]> {
  const targets = await targetRepo.list(userId);
  return targets.map((t) => ({
    effectiveFrom: t.effectiveFrom.toISOString().slice(0, 10),
    cal_min: num(t.calorieMin),
    cal_max: num(t.calorieMax),
  }));
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
  const days = await dayStatRepo.readLightweight(userId, latest ? rollingRange(latest) : undefined);
  // vs_target is judged per window against the days' own frozen bands (B-100) — no current zone.
  const logged = toDayStats(days).filter((s) => s.date <= today);
  return rolling(logged, STATS_ROLLING_WINDOWS);
}

/** GET /stats/adherence?year=YYYY — heatmap + monthly pivots + key figures + signals.
 * Needs full history (overall ok-rate, best month), read lightweight (M9d perf). */
export async function getAdherence(userId: string, year: number): Promise<AdherenceResponse> {
  const [days, zone, bands, burnCtx, weighIns] = await Promise.all([
    dayStatRepo.readLightweight(userId),
    currentZone(userId),
    targetBands(userId),
    // The per-day burn (profile + weigh-in series) splits each NOK day into deficit/surplus on
    // the heatmap + monthly bars (B-167); reuses the Journal machinery verbatim (no recompute).
    loadBurnContext(userId),
    // Weight records (B-197): min/max weigh-in over all data + the selected year, each with date.
    weightRepo.findAll(userId),
  ]);
  const records = weightRecords(
    weighIns.map((w) => ({ date: w.date.toISOString().slice(0, 10), weightKg: num(w.weightKg) })),
    year,
  );
  const today = todayString();
  // Future planned days (date > today) are excluded from every aggregate until they
  // arrive (stats-adherence.md §1) — filtering here covers ok-rate, streak, best month,
  // heatmap, pivots and signals, which all derive from these arrays.
  const logged = toDayStats(days).filter((s) => s.date <= today);
  // burnGap drives only the heatmap/monthly NOK split (B-167), so compute it for the SELECTED
  // YEAR only — not the whole history (perf B-171). The other figures (rate/streak/best-month/
  // signals) ignore burnGap, so `logged` skips the burn entirely.
  const yearLogged = toDayStats(
    days.filter((d) => d.date.startsWith(`${year}-`)),
    burnCtx,
  ).filter((s) => s.date <= today);
  return {
    heatmap: heatmap(yearLogged, year),
    monthly: monthlyPivot(yearLogged, bands, year),
    key: {
      year_ok_rate: okRate(yearLogged),
      overall_ok_rate: okRate(logged),
      current_ok_streak: currentOkStreak(logged),
      best_month: bestMonth(logged, BEST_MONTH_MIN_DAYS),
    },
    target_zone: zone,
    signals: signals(logged, zone, NOK_RUN_ALERT, OK_RATE_GOOD_PCT),
    records,
  };
}
