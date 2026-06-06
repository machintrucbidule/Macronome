import type { CreateTargetRequest, PreviewTargetRequest, Target } from '@macronome/shared';

// Local form state for the manual targets (left column). Kept as strings so the inputs
// stay controlled; converted to the typed request on save. The engine is never
// recomputed here — derived tiles come from GET /target after the save round-trips.

export interface TargetDraft {
  calorieMin: string;
  calorieMax: string;
  proteinGPerKg: string;
  fatGPerKg: string;
  targetWeightKg: string;
  rateKgPerWeek: string;
}

const str = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : String(n);

export function initialTargetDraft(target: Target | null): TargetDraft {
  return {
    calorieMin: str(target?.calorie_min),
    calorieMax: str(target?.calorie_max),
    proteinGPerKg: str(target?.protein_g_per_kg),
    fatGPerKg: str(target?.fat_g_per_kg),
    targetWeightKg: str(target?.target_weight_kg ?? null),
    rateKgPerWeek: str(target?.rate_kg_per_week ?? null),
  };
}

const optional = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/** Build the POST body. effective_from defaults to today (a new history row). */
export function draftToBody(draft: TargetDraft): CreateTargetRequest {
  return {
    calorie_min: Number(draft.calorieMin),
    calorie_max: Number(draft.calorieMax),
    protein_g_per_kg: Number(draft.proteinGPerKg),
    fat_g_per_kg: Number(draft.fatGPerKg),
    target_weight_kg: optional(draft.targetWeightKg),
    rate_kg_per_week: optional(draft.rateKgPerWeek),
    effective_from: new Date().toISOString().slice(0, 10),
  };
}

/** Build the stateless preview body (no effective_from — nothing is persisted). Used to
 * recompute the engine live while editing (DECISIONS B-042). */
export function draftToPreviewBody(draft: TargetDraft): PreviewTargetRequest {
  return {
    calorie_min: Number(draft.calorieMin),
    calorie_max: Number(draft.calorieMax),
    protein_g_per_kg: Number(draft.proteinGPerKg),
    fat_g_per_kg: Number(draft.fatGPerKg),
    target_weight_kg: optional(draft.targetWeightKg),
    rate_kg_per_week: optional(draft.rateKgPerWeek),
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
