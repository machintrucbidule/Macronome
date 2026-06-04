import { carbCeilingG, fatFloorG, proteinFloorG } from '../targets/index.js';

// Target-snapshot resolution (spec/logic/day-snapshot-verdict.md §2). Pure assembly of
// the values frozen on a day from THAT date's effective target + body weight. cal_min/
// cal_max drive the stored verdict; the gram thresholds are display-only and may be null
// when there is no target or no weigh-in yet. The service decides live-vs-frozen timing.

export interface SnapshotTarget {
  calorieMin: number;
  calorieMax: number;
  proteinGPerKg: number;
  fatGPerKg: number;
}

export interface SnapshotInputs {
  /** The target in effect on the day's date, or null when none exists yet. */
  target: SnapshotTarget | null;
  /** Body weight in effect on the day's date (kg), or null when no weigh-in yet. */
  weightKg: number | null;
}

export interface ResolvedSnapshot {
  cal_min: number;
  cal_max: number;
  protein_floor_g: number | null;
  fat_floor_g: number | null;
  carb_ceiling_g: number | null;
}

/** Build the frozen-able target snapshot. Floors/ceiling are null without target+weight. */
export function resolveSnapshot({ target, weightKg }: SnapshotInputs): ResolvedSnapshot {
  const calMin = target?.calorieMin ?? 0;
  const calMax = target?.calorieMax ?? 0;
  if (target === null || weightKg === null) {
    return {
      cal_min: calMin,
      cal_max: calMax,
      protein_floor_g: null,
      fat_floor_g: null,
      carb_ceiling_g: null,
    };
  }
  const proteinFloor = proteinFloorG(target.proteinGPerKg, weightKg);
  const fatFloor = fatFloorG(target.fatGPerKg, weightKg);
  const carbCeiling = carbCeilingG({
    calorieMax: calMax,
    proteinFloorG: proteinFloor,
    fatFloorG: fatFloor,
  });
  return {
    cal_min: calMin,
    cal_max: calMax,
    protein_floor_g: proteinFloor,
    fat_floor_g: fatFloor,
    carb_ceiling_g: carbCeiling,
  };
}
