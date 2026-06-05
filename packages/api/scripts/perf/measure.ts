import { FoodListQuerySchema, LoggableSearchQuerySchema } from '@macronome/shared';
import * as foodsService from '../../src/services/foods.js';
import * as recipesService from '../../src/services/recipes.js';
import * as statsService from '../../src/services/stats.js';
import { BUDGETS, REPEATS, SEARCH_TERMS } from './config.js';

// Measures the hot read paths against the large seed by calling the SERVICE layer directly
// (exercises repository + domain, minus HTTP noise). Each call is repeated; min/median/max
// are reported. A median over its soft budget is flagged but never fails the run.

interface Row {
  call: string;
  min_ms: number;
  median_ms: number;
  max_ms: number;
  budget_ms: number;
  over: boolean;
}

function summarise(samples: number[]): { min: number; median: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const round = (n: number): number => Math.round(n * 10) / 10;
  return {
    min: round(sorted[0] ?? 0),
    median: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
    max: round(sorted[sorted.length - 1] ?? 0),
  };
}

async function timeit(call: string, budget: number, fn: () => Promise<unknown>): Promise<Row> {
  const samples: number[] = [];
  for (let i = 0; i < REPEATS; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  const { min, median, max } = summarise(samples);
  return {
    call,
    min_ms: min,
    median_ms: median,
    max_ms: max,
    budget_ms: budget,
    over: median > budget,
  };
}

export async function runMeasurements(userId: string, year: number): Promise<void> {
  const rows: Row[] = [];
  for (const term of SEARCH_TERMS) {
    const label = `foods.list q='${term || '(browse)'}'`;
    rows.push(
      await timeit(label, BUDGETS.search, () =>
        foodsService.list(userId, FoodListQuerySchema.parse(term ? { q: term } : {})),
      ),
    );
  }
  rows.push(
    await timeit("loggable q='creme'", BUDGETS.search, () =>
      recipesService.loggableSearch(userId, LoggableSearchQuerySchema.parse({ q: 'creme' })),
    ),
  );
  rows.push(await timeit('stats.rolling', BUDGETS.stats, () => statsService.getRolling(userId)));
  rows.push(
    await timeit(`stats.adherence ${year}`, BUDGETS.stats, () =>
      statsService.getAdherence(userId, year),
    ),
  );

  console.log('\n=== Latency (ms) — median of', REPEATS, 'runs ===');
  console.table(rows);
  const over = rows.filter((r) => r.over);
  if (over.length) {
    console.warn(`\n⚠ ${over.length} call(s) over budget: ${over.map((r) => r.call).join(', ')}`);
  } else {
    console.log('\n✓ All calls within their soft budgets.');
  }
}
