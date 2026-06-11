import { formatInt, signedInt } from '../../lib/format/number';
import styles from './BandCard.module.css';

// Macro card with a directional threshold bar (design/components/metric-cards.md):
// floor (protein, fat) → OK when value ≥ threshold; ceiling (carb) → OK when value ≥/≤ threshold.
// Value (consumed) and threshold come from the server; this positions the bar and picks the word.

interface MacroCardProps {
  label: string;
  value: number;
  threshold: number | null;
  mode: 'floor' | 'ceiling';
  thresholdText: string;
  status: { ok: string; bad: string };
  unit: string;
  /** Partiel (summary) day: only kcal is meaningful, so show "—" and no bar/status (B-086). */
  muted?: boolean;
}

/** Écart colour class (B-139): green when on target (ok), else red. */
function ecartClass(ok: boolean): string {
  return (ok ? styles.ecartGood : styles.ecartBad) ?? '';
}

// The directional zone/fill bar, extracted so MacroCard itself stays simple. The notch (B-044)
// sits above the fill so the threshold stays legible over any zone colour.
function MacroBar({
  value,
  threshold,
  ceiling,
  ok,
}: {
  value: number;
  threshold: number;
  ceiling: boolean;
  ok: boolean;
}) {
  const scaleMax = threshold * 1.7 || 1;
  const thrPct = (threshold / scaleMax) * 100;
  const fillPct = (Math.min(value, scaleMax) / scaleMax) * 100;
  const okMix = 'color-mix(in srgb, var(--ok) 22%, transparent)';
  const nokMix = 'color-mix(in srgb, var(--nok) 22%, transparent)';
  const band = ceiling
    ? `linear-gradient(90deg, ${okMix} 0 ${thrPct}%, ${nokMix} ${thrPct}% 100%)`
    : `linear-gradient(90deg, ${nokMix} 0 ${thrPct}%, ${okMix} ${thrPct}% 100%)`;

  return (
    <div className={styles.bar} style={{ background: band }}>
      <span
        className={styles.fill}
        style={{ width: `${fillPct}%`, background: ok ? 'var(--ok)' : 'var(--nok)' }}
      />
      <span className={styles.tick} style={{ left: `${thrPct}%` }} />
    </div>
  );
}

export function MacroCard({
  label,
  value,
  threshold,
  mode,
  thresholdText,
  status,
  unit,
  muted = false,
}: MacroCardProps) {
  const ceiling = mode === 'ceiling';
  const ok = threshold === null || (ceiling ? value <= threshold : value >= threshold);
  const stateClass = muted ? '' : ok ? styles.good : styles.bad;

  return (
    <div className={[styles.card, stateClass].filter(Boolean).join(' ')}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.thr}>{thresholdText}</span>
      </div>
      {threshold !== null && !muted && (
        <MacroBar value={value} threshold={threshold} ceiling={ceiling} ok={ok} />
      )}
      <div className={styles.bot}>
        <span className={styles.val}>{muted ? '—' : `${formatInt(value)} ${unit}`}</span>
        {!muted && (
          <span className={styles.statusCol}>
            <span className={styles.status}>{ok ? status.ok : status.bad}</span>
            {/* Signed écart vs the threshold (B-139), below the status, right-aligned. Floor:
                below red / at-or-above green; ceiling: below green / above red — i.e. green iff
                on target (ok), else red. Hidden when there is no threshold. */}
            {threshold !== null && (
              <span className={`${styles.ecart} ${ecartClass(ok)}`}>
                {signedInt(value - threshold)}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
