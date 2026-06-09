// AI-assistant connection — single source of truth for the fixed task keys and their
// English default prompts, imported by `api` (seed/normalise a config) and `web` (the
// per-task "Reset to default" action). No business logic lives here.
// Source: spec/logic/ai-connection.md §1 (tasks), §3 (default prompts). DECISIONS Gap 14 / B-117.

/** The three fixed AI tasks (named, not user-addable). */
export const AI_TASK_KEYS = ['dish_photo_macros', 'meal_suggestions', 'advice'] as const;
export type AiTaskKey = (typeof AI_TASK_KEYS)[number];

/**
 * English default prompt per task (the user-editable request *scope*; provider-facing, so
 * never translated — spec §3). These are provisional and seed a new config / power the
 * "Reset to default" action. The technical response-format instructions are NOT here —
 * they are hard-coded in the app and appended at call time.
 */
const DEFAULT_TASK_PROMPTS: Record<AiTaskKey, string> = {
  dish_photo_macros:
    'Estimate the macronutrients (protein, fat, carbs) and calories of this dish. Use the ' +
    'photo(s) when provided; otherwise rely on the written description. Identify the foods and ' +
    'their approximate quantities.',
  meal_suggestions: 'Suggest meal ideas that fit the indicated macro and calorie targets.',
  advice:
    'Give personalized nutrition advice based on the provided tracking data ' +
    '(recent intake, target adherence, weight trend).',
};

/** Pure function — the English default prompt for a task (spec §3, oracle §8.7). */
export function defaultTaskPrompt(task: AiTaskKey): string {
  return DEFAULT_TASK_PROMPTS[task];
}

// Best-effort filter for image-capable models in the dish_photo_macros picker. The
// OpenAI-compatible /models listing exposes only ids (no capability flags), so we exclude the
// families that cannot take an image as input (embeddings, image/video generation, audio/TTS).
// Heuristic, id-based — keeps everything else (e.g. gemini-*-flash/pro accept images).
const NON_VISION_MODEL_PATTERNS = [
  /embedding/i,
  /imagen/i,
  /\bveo/i,
  /tts/i,
  /-image\b/i,
  /image-generation/i,
  /\baqa\b/i,
  /-live/i,
];

/** True when a provider model id is plausibly able to accept image input (not gen/embed/audio). */
export function isVisionModel(id: string): boolean {
  return !NON_VISION_MODEL_PATTERNS.some((re) => re.test(id));
}
