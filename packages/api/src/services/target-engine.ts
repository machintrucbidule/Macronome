import type { EngineReadout, Sex, Target, TargetWarningCode } from '@macronome/shared';
import { TargetWarning } from '@macronome/shared';
import type { Target as TargetModel, WeightEntry as WeightEntryModel } from '@prisma/client';
import type { ProfileRow } from '../data/repositories/profile.repo.js';
import {
  ageYears,
  calorieMidpoint,
  deficitAtTarget,
  estimatedBurn,
  kgPerWeek,
  mifflinStJeor,
  type RecentActivity,
} from '../domain/metabolic/index.js';
import { carbCeilingG, fatFloorG, proteinFloorG } from '../domain/targets/index.js';
import { bmi } from '../domain/weight/bmi.js';

// Pure assembly of the Cibles engine readout from the persisted rows + the recent
// activity. It calls the domain (logic/metabolic-engine.md, targets-macros.md) and
// returns full-precision numbers (the web rounds). Weight-dependent figures are null
// when there is no weigh-in yet; `empirical_burn` needs logged intake (M3) and stays
// null in M2 — both surfaced as warnings, never errors.

const num = (d: { toString(): string }): number => Number(d.toString());
const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

/** Map a persisted target row to the contract DTO (carbs are never stored). */
export function targetToDto(row: TargetModel): Target {
  return {
    calorie_min: row.calorieMin,
    calorie_max: row.calorieMax,
    protein_g_per_kg: num(row.proteinGPerKg),
    fat_g_per_kg: num(row.fatGPerKg),
    target_weight_kg: row.targetWeightKg === null ? null : num(row.targetWeightKg),
    rate_kg_per_week: row.rateKgPerWeek === null ? null : num(row.rateKgPerWeek),
    effective_from: toDateString(row.effectiveFrom),
  };
}

export interface EngineInputs {
  profile: ProfileRow;
  weightRow: WeightEntryModel | null;
  targetRow: TargetModel | null;
  recent: RecentActivity;
  refDate: Date;
}

export interface EngineResult {
  engine: EngineReadout;
  warnings: TargetWarningCode[];
}

/** BMR + estimated burn (null without a current weight). */
function deriveBurn(
  profile: ProfileRow,
  currentWeightKg: number | null,
  age: number,
  recentMultiplier: number,
): { bmr: number | null; estimated: number | null } {
  if (currentWeightKg === null) return { bmr: null, estimated: null };
  const bmr = mifflinStJeor({
    weightKg: currentWeightKg,
    heightCm: num(profile.heightCm),
    ageYears: age,
    sex: profile.sex as Sex,
  });
  return { bmr, estimated: estimatedBurn(bmr, recentMultiplier) };
}

/** Protein/fat floors + carb ceiling (null without a target or a current weight). */
function deriveMacros(
  targetRow: TargetModel | null,
  currentWeightKg: number | null,
): { proteinFloor: number | null; fatFloor: number | null; carbCeiling: number | null } {
  if (targetRow === null || currentWeightKg === null) {
    return { proteinFloor: null, fatFloor: null, carbCeiling: null };
  }
  const proteinFloor = proteinFloorG(num(targetRow.proteinGPerKg), currentWeightKg);
  const fatFloor = fatFloorG(num(targetRow.fatGPerKg), currentWeightKg);
  const carbCeiling = carbCeilingG({
    calorieMax: targetRow.calorieMax,
    proteinFloorG: proteinFloor,
    fatFloorG: fatFloor,
  });
  return { proteinFloor, fatFloor, carbCeiling };
}

/** Deficit at target (midpoint − estimated burn) + its kg/week equivalent. */
function deriveDeficit(
  targetRow: TargetModel | null,
  estimated: number | null,
): { deficit: number | null; kgWeek: number | null } {
  if (targetRow === null || estimated === null) return { deficit: null, kgWeek: null };
  const deficit = deficitAtTarget(
    calorieMidpoint(targetRow.calorieMin, targetRow.calorieMax),
    estimated,
  );
  return { deficit, kgWeek: kgPerWeek(deficit) };
}

/** Derive the full engine readout + non-blocking warnings for one user, as of a date. */
export function computeEngine({
  profile,
  weightRow,
  targetRow,
  recent,
  refDate,
}: EngineInputs): EngineResult {
  const age = ageYears(profile.birthdate, refDate);
  const currentWeightKg = weightRow === null ? null : num(weightRow.weightKg);
  const { bmr, estimated } = deriveBurn(profile, currentWeightKg, age, recent.multiplier);
  const { proteinFloor, fatFloor, carbCeiling } = deriveMacros(targetRow, currentWeightKg);
  const { deficit, kgWeek } = deriveDeficit(targetRow, estimated);
  // Target BMI is derived from the *target* weight (not the current one) + height
  // (targets-macros.md §6); null when no target weight has been set.
  const targetBmi =
    targetRow !== null && targetRow.targetWeightKg !== null
      ? bmi(num(targetRow.targetWeightKg), num(profile.heightCm))
      : null;

  const engine: EngineReadout = {
    age,
    bmr,
    current_weight_kg: currentWeightKg,
    recent_avg_activity: recent.multiplier,
    estimated_burn: estimated,
    empirical_burn: null, // needs logged intake + weight history → wired in M3/M4
    protein_floor_g: proteinFloor,
    fat_floor_g: fatFloor,
    carb_ceiling_g: carbCeiling,
    deficit_at_target: deficit,
    kg_per_week: kgWeek,
    target_bmi: targetBmi,
  };

  const warnings: TargetWarningCode[] = [];
  if (currentWeightKg === null) warnings.push(TargetWarning.NoWeight);
  if (recent.insufficientData) warnings.push(TargetWarning.InsufficientActivityData);
  if (carbCeiling !== null && carbCeiling <= 0) warnings.push(TargetWarning.CarbCeilingNonPositive);

  return { engine, warnings };
}
