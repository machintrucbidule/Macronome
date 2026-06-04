import { EMA_ALPHA } from '@macronome/shared';

// EMA trend over the ordered weigh-in series (spec/logic/weight-periods-trajectory.md §3).
// Each weigh-in is one point (no daily resampling); seeded at the first weigh-in's real
// weight. α defaults to the named EMA_ALPHA constant (DECISIONS Gap #9).

/** Exponential moving average of the weight series: ema[0]=w[0]; ema[i]=α·w[i]+(1−α)·ema[i−1]. */
export function deriveEma(weights: number[], alpha: number = EMA_ALPHA): number[] {
  const ema: number[] = [];
  for (let i = 0; i < weights.length; i += 1) {
    const w = weights[i]!;
    ema.push(i === 0 ? w : alpha * w + (1 - alpha) * ema[i - 1]!);
  }
  return ema;
}
