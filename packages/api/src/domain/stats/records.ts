import type { WeightRecord, WeightRecords } from '@macronome/shared';

// Weight records (spec/logic/stats-adherence.md §9, B-197). Pure: min/max weigh-in over all
// data and over the selected year, each with its date. On a tie (the record weight reached on
// several days) the most-recent date wins. No DB, no I/O.

export interface WeightSample {
  /** ISO date 'YYYY-MM-DD'. */
  date: string;
  weightKg: number;
}

function extremes(samples: WeightSample[]): {
  high: WeightRecord | null;
  low: WeightRecord | null;
} {
  if (samples.length === 0) return { high: null, low: null };
  let high = samples[0] as WeightSample;
  let low = samples[0] as WeightSample;
  for (const s of samples) {
    // Strictly better weight, or same weight on a more-recent date (order-independent tie-break).
    if (s.weightKg > high.weightKg || (s.weightKg === high.weightKg && s.date > high.date))
      high = s;
    if (s.weightKg < low.weightKg || (s.weightKg === low.weightKg && s.date > low.date)) low = s;
  }
  return {
    high: { weight_kg: high.weightKg, date: high.date },
    low: { weight_kg: low.weightKg, date: low.date },
  };
}

export function weightRecords(samples: WeightSample[], year: number): WeightRecords {
  const yearSamples = samples.filter((s) => s.date.startsWith(`${year}-`));
  return { all: extremes(samples), year: extremes(yearSamples) };
}
