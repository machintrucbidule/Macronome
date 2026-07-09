import { expect, test } from 'vitest';
import {
  AI_MODEL_PRICES,
  AI_PRICE_MODELS,
  AI_TASK_TOKEN_ESTIMATES,
  USD_TO_EUR,
  estimateTaskCostEur,
} from './ai-pricing.js';

// B-211: the per-request cost is a pure function of the hard-coded token estimates × the model prices
// × the USD→EUR rate. These oracles pin the formula and keep the constants visible in one place.

test('estimateTaskCostEur totals the token estimate and prices every model', () => {
  const est = estimateTaskCostEur('advice');
  const { input, output } = AI_TASK_TOKEN_ESTIMATES.advice; // 8000 / 800
  expect(est.totalTokens).toBe(input + output);
  expect(Object.keys(est.byModel).sort()).toEqual([...AI_PRICE_MODELS].sort());

  // Sonnet: (8000/1e6·3 + 800/1e6·15) · 0.92 = (0.024 + 0.012) · 0.92 = 0.03312 €
  const p = AI_MODEL_PRICES.claude_sonnet;
  const expected =
    ((input / 1_000_000) * p.input_usd_per_mtok + (output / 1_000_000) * p.output_usd_per_mtok) *
    USD_TO_EUR;
  expect(est.byModel.claude_sonnet).toBeCloseTo(expected, 6);
  expect(est.byModel.claude_sonnet).toBeCloseTo(0.03312, 5);
});

test('cheaper models cost less than dearer ones for the same request', () => {
  const est = estimateTaskCostEur('meal_suggestions');
  // Flash (0.30/2.50) is the cheapest; Sonnet (3/15) the dearest.
  expect(est.byModel.gemini_flash).toBeLessThan(est.byModel.gemini_pro);
  expect(est.byModel.claude_haiku).toBeLessThan(est.byModel.claude_sonnet);
  expect(est.byModel.gemini_flash).toBeLessThan(est.byModel.claude_sonnet);
});

test('every task has an estimate for every model', () => {
  for (const task of ['dish_photo_macros', 'meal_suggestions', 'advice'] as const) {
    const est = estimateTaskCostEur(task);
    expect(est.totalTokens).toBeGreaterThan(0);
    for (const m of AI_PRICE_MODELS) expect(est.byModel[m]).toBeGreaterThan(0);
  }
});
