import { autoVerdict, effectiveVerdict } from '../domain/day-verdict/index.js';
import type { Verdict } from '../domain/day-verdict/index.js';
import { netLeftover, prorateConsumed, scaleMacros } from '../domain/leftover/index.js';
import type { DayStat } from '../domain/stats/index.js';
import type { LightDay, LightEntry, LightGroup } from '../data/repositories/day-stat.repo.js';

// Maps the lightweight stats read (day-stat.repo.ts) to the DayStat the stats domain consumes,
// or null when the day is NOT logged (spec/logic/stats-adherence.md §1, day-snapshot-verdict.md
// §8): a summary day without summary_kcal, or a detailed day whose consumed kcal sum to 0
// (cleared / comment-only / all-leftover — a "red" day), carries no calorie value and is
// excluded. Counting it would let a comment-only day pollute the OK-rate as a phantom NOK-SOUS
// (the qty-0 garde-manger pre-fill leaves entry rows even when nothing was eaten). The per-day
// kcal reuses the domain leftover proration so the figure matches the full day-assembler path;
// verdicts use the STORED snapshot (frozen history — the journal pattern).

/** Consumed kcal over a detailed day's entries, applying leftover proration (domain reuse). */
function consumedKcal(entries: LightEntry[], groups: LightGroup[]): number {
  if (groups.length === 0) return entries.reduce((sum, e) => sum + e.snapKcal, 0);
  const servedById = new Map(entries.map((e) => [e.id, e.servedGrams ?? 0]));
  const ctx = new Map<string, { net: number; servedTotal: number }>();
  for (const g of groups) {
    const servedTotal = g.entryIds.reduce((sum, id) => sum + (servedById.get(id) ?? 0), 0);
    const net = netLeftover(g.grossGrams, g.tareG);
    for (const id of g.entryIds) ctx.set(id, { net, servedTotal });
  }
  let total = 0;
  for (const e of entries) {
    const c = ctx.get(e.id);
    if (c && e.servedGrams !== null) {
      const grams = prorateConsumed(e.servedGrams, c.net, c.servedTotal);
      total += scaleMacros(
        { kcal: e.snapKcal, fat: 0, carb: 0, protein: 0 },
        grams,
        e.servedGrams,
      ).kcal;
    } else {
      total += e.snapKcal;
    }
  }
  return total;
}

/** DayStat for a logged day, or null when the day carries no calorie value (§8). */
export function dayStat(day: LightDay): DayStat | null {
  const isSummary = day.kind === 'summary';
  const kcal = isSummary ? (day.summaryKcal ?? 0) : consumedKcal(day.entries, day.groups);
  // Logged = carries a calorie value: a summary day's total, or a detailed day with Σ > 0.
  const logged = isSummary ? day.summaryKcal !== null : kcal > 0;
  if (!logged) return null;
  const auto = autoVerdict(kcal, day.snapshot.cal_min, day.snapshot.cal_max);
  const override = (day.verdictOverride ?? null) as Verdict | null;
  return { date: day.date, kcal, verdict: effectiveVerdict(override, auto) as Verdict };
}

/** Map a list of light day records to DayStat, dropping not-logged days. */
export function toDayStats(days: LightDay[]): DayStat[] {
  return days.map(dayStat).filter((s): s is DayStat => s !== null);
}
