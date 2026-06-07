import type { CreateTargetRequest, PreviewTargetRequest, Target } from '@macronome/shared';

// Local form state for the manual targets (left column). Kept as strings so the inputs
// stay controlled; converted to the typed request on save. The engine is never recomputed
// here — derived tiles come from the server (POST /target/preview while editing, then
// GET /target after the save). TH-1 adds `effectiveFrom`: the form doubles as the history
// editor, so the effective date is now a field (back-datable on create, editable on a row).

export interface TargetDraft {
  calorieMin: string;
  calorieMax: string;
  proteinGPerKg: string;
  fatGPerKg: string;
  targetWeightKg: string;
  rateKgPerWeek: string;
  effectiveFrom: string; // YYYY-MM-DD
}

const str = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : String(n);

/** Today as YYYY-MM-DD (the default effective date for a new/current target). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Seed the form from a persisted target (current or a history version), or a blank
 * draft effective today when there is none. */
export function initialTargetDraft(target: Target | null): TargetDraft {
  return {
    calorieMin: str(target?.calorie_min),
    calorieMax: str(target?.calorie_max),
    proteinGPerKg: str(target?.protein_g_per_kg),
    fatGPerKg: str(target?.fat_g_per_kg),
    targetWeightKg: str(target?.target_weight_kg ?? null),
    rateKgPerWeek: str(target?.rate_kg_per_week ?? null),
    effectiveFrom: target?.effective_from ?? today(),
  };
}

/** A blank draft effective today — "＋ Nouvelle cible" (back-datable via the date field). */
export function newTargetDraft(): TargetDraft {
  return initialTargetDraft(null);
}

const optional = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/** Build the POST body for a new/current target (effective_from from the date field). */
export function draftToBody(draft: TargetDraft): CreateTargetRequest {
  return {
    calorie_min: Number(draft.calorieMin),
    calorie_max: Number(draft.calorieMax),
    protein_g_per_kg: Number(draft.proteinGPerKg),
    fat_g_per_kg: Number(draft.fatGPerKg),
    target_weight_kg: optional(draft.targetWeightKg),
    rate_kg_per_week: optional(draft.rateKgPerWeek),
    effective_from: draft.effectiveFrom,
  };
}

/** Build the PATCH body for an edited history version (same shape, effective_from incl.). */
export function draftToPatchBody(draft: TargetDraft): CreateTargetRequest {
  return draftToBody(draft);
}

/** Build the stateless preview body. `includeAsOf` adds effective_from so the engine is
 * computed as of that date — used when editing a PAST version (or a back-dated new one);
 * omitted for the active current target so its engine reflects today (DECISIONS TH-1). */
export function draftToPreviewBody(draft: TargetDraft, includeAsOf: boolean): PreviewTargetRequest {
  return {
    calorie_min: Number(draft.calorieMin),
    calorie_max: Number(draft.calorieMax),
    protein_g_per_kg: Number(draft.proteinGPerKg),
    fat_g_per_kg: Number(draft.fatGPerKg),
    target_weight_kg: optional(draft.targetWeightKg),
    rate_kg_per_week: optional(draft.rateKgPerWeek),
    ...(includeAsOf ? { effective_from: draft.effectiveFrom } : {}),
  };
}

/** Calorie min/max must be present and form a valid range to enable Save. */
export function isSavable(draft: TargetDraft): boolean {
  const min = Number(draft.calorieMin);
  const max = Number(draft.calorieMax);
  return (
    draft.calorieMin.trim() !== '' &&
    draft.calorieMax.trim() !== '' &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min > 0 &&
    max >= min
  );
}
