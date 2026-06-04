import type { BmiCategory } from '@macronome/shared';

// BMI (spec/logic/weight-periods-trajectory.md §5): weight_kg / (height_cm/100)².
// Stored exact; the web rounds to 1 decimal for display.

/** Body-mass index in kg/m². */
export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/** Display category label key (thresholds per §5; never used in a computation). */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'normal';
  if (value < 30) return 'overweight';
  return 'obese';
}
