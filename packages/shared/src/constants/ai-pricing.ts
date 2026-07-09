import type { AiTaskKey } from './ai.js';

// AI per-request cost estimation (B-211). An INDICATIVE estimate shown under each Assistant-IA task
// prompt: a typical token count per task × the provider prices → a euro figure per model family. The
// real cost varies with the runtime payload (the photo, the food pool, the whole tracking dataset for
// advice) + the reply length, so this is a ballpark, not an exact bill. Prices are hard-coded and
// refreshed by hand (see AI_PRICING_AS_OF). No calculation lives elsewhere — this is the one source.

/** The priced model families (owner decision: both Gemini tiers + the two current Claude tiers). */
export const AI_PRICE_MODELS = [
  'gemini_flash',
  'gemini_pro',
  'claude_haiku',
  'claude_sonnet',
] as const;
export type AiPriceModel = (typeof AI_PRICE_MODELS)[number];

/** The date the hard-coded prices below were last verified (manual refresh). */
export const AI_PRICING_AS_OF = '2026-07-09';

/** Approximate USD→EUR conversion (same "as of" date; a rough constant for an indicative figure). */
export const USD_TO_EUR = 0.92;

interface ModelPrice {
  /** Display label shown in the UI. */
  label: string;
  /** Provider price per 1,000,000 input / output tokens, in USD. */
  input_usd_per_mtok: number;
  output_usd_per_mtok: number;
}

/** Provider list prices per 1M tokens, USD (as of AI_PRICING_AS_OF). Sources: Google + Anthropic. */
export const AI_MODEL_PRICES: Record<AiPriceModel, ModelPrice> = {
  gemini_flash: { label: 'Gemini 2.5 Flash', input_usd_per_mtok: 0.3, output_usd_per_mtok: 2.5 },
  gemini_pro: { label: 'Gemini 2.5 Pro', input_usd_per_mtok: 1.25, output_usd_per_mtok: 10 },
  claude_haiku: { label: 'Claude Haiku 4.5', input_usd_per_mtok: 1, output_usd_per_mtok: 5 },
  claude_sonnet: { label: 'Claude Sonnet', input_usd_per_mtok: 3, output_usd_per_mtok: 15 },
};

/** Typical (indicative, tunable) tokens per request per task — input (prompt + attached data) and
 *  output (the reply). Rough chars/4 over the assembled prompt; photo/food-pool/history vary the real
 *  input a lot, so these are representative middles. */
export const AI_TASK_TOKEN_ESTIMATES: Record<AiTaskKey, { input: number; output: number }> = {
  // Scope + hard-coded format instruction + ~1 photo (image tokens vary by provider) → small JSON.
  dish_photo_macros: { input: 1300, output: 60 },
  // Scope + candidate-food pool + day context → a 3-proposal JSON (no quantities).
  meal_suggestions: { input: 2500, output: 200 },
  // Scope + the full aggregated tracking dataset → a free-Markdown reply.
  advice: { input: 8000, output: 800 },
};

export interface TaskCostEstimate {
  totalTokens: number;
  /** Estimated euro cost of one request, per model family (unrounded; the UI formats). */
  byModel: Record<AiPriceModel, number>;
}

/** Estimate the euro cost of one request for a task, across every priced model. Pure. */
export function estimateTaskCostEur(task: AiTaskKey): TaskCostEstimate {
  const { input, output } = AI_TASK_TOKEN_ESTIMATES[task];
  const byModel = {} as Record<AiPriceModel, number>;
  for (const m of AI_PRICE_MODELS) {
    const p = AI_MODEL_PRICES[m];
    const usd =
      (input / 1_000_000) * p.input_usd_per_mtok + (output / 1_000_000) * p.output_usd_per_mtok;
    byModel[m] = usd * USD_TO_EUR;
  }
  return { totalTokens: input + output, byModel };
}
