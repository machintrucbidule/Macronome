import type { Sex } from '@macronome/shared';

// Basal metabolic rate — Mifflin-St Jeor (spec/logic/metabolic-engine.md §2):
// BMR = 10×weight_kg + 6.25×height_cm − 5×age + s, with s = +5 (male) / −161 (female).
// Stored exact; the web rounds to an integer for display.

const SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161 };

export interface BmrInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
}

/** Mifflin-St Jeor BMR in kcal/day. */
export function mifflinStJeor({ weightKg, heightCm, ageYears, sex }: BmrInput): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + SEX_CONSTANT[sex];
}
