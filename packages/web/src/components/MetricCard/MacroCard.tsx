import { formatInt } from '../../lib/format/number';
import styles from './BandCard.module.css';

// Macro card with a directional threshold bar (design/components/metric-cards.md):
// floor (protein, fat) → OK when value ≥ threshold; ceiling (carb) → OK when value ≤ threshold.
// Value (consumed) and threshold come from the server; this positions the bar and picks the word.

interface MacroCardProps {
  label: string;
  value: number;
  threshold: number | null;
  mode: 'floor' | 'ceiling';
  thresholdText: string;
  status: { ok: string; bad: string };
  unit: string;
}

export function MacroCard({
  label,
  value,
  threshold,
  mode,
  thresholdText,
  status,
  unit,
}: MacroCardProps) {
  const hasThreshold = threshold !== null;
  const ceiling = mode === 'ceiling';
  const ok = !hasThreshold || (ceiling ? value <= threshold : value >= threshold);

  const base = threshold ?? 0;
  const scaleMax = base * 1.7 || 1;
  const thrPct = (base / scaleMax) * 100;
  const fillPct = (Math.min(value, scaleMax) / scaleMax) * 100;

  const okMix = 'color-mix(in srgb, var(--ok) 22%, transparent)';
  const nokMix = 'color-mix(in srgb, var(--nok) 22%, transparent)';
  const band = ceiling
    ? `linear-gradient(90deg, ${okMix} 0 ${thrPct}%, ${nokMix} ${thrPct}% 100%)`
    : `linear-gradient(90deg, ${nokMix} 0 ${thrPct}%, ${okMix} ${thrPct}% 100%)`;

  return (
    <div className={[styles.card, ok ? styles.good : styles.bad].join(' ')}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.thr}>{thresholdText}</span>
      </div>
      {hasThreshold && (
        <div className={styles.bar} style={{ background: band }}>
          <span
            className={styles.fill}
            style={{ width: `${fillPct}%`, background: ok ? 'var(--ok)' : 'var(--nok)' }}
          />
          <span className={styles.tick} style={{ left: `${thrPct}%` }} />
        </div>
      )}
      <div className={styles.bot}>
        <span className={styles.val}>
          {formatInt(value)} {unit}
        </span>
        <span className={styles.status}>{ok ? status.ok : status.bad}</span>
      </div>
    </div>
  );
}
