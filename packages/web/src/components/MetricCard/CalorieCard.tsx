import { useEffect, useState } from 'react';
import { signedInt } from '../../lib/format/number';
import styles from './BandCard.module.css';

// Wide calorie card with the three-zone target band (design/components/metric-cards.md).
// The value (day kcal) and the band (cal_min/cal_max) come from the server; this only
// positions the bar and picks the status word — it is not the authoritative day verdict.
// On a Partiel day it is editable (DK-1 / B-079): the value becomes an inline input writing
// the day's summary_kcal (same commit rule as the Journal Calories cell).

interface CalorieStatus {
  inBand: string;
  under: string;
  over: string;
}

/** Signed kcal écart vs the band (B-139): how far below cal_min or above cal_max, null in-band. */
function kcalGap(value: number, min: number, max: number): number | null {
  if (value < min) return value - min;
  if (value > max) return value - max;
  return null;
}

interface CalorieCardProps {
  label: string;
  value: number;
  min: number;
  max: number;
  thresholdText: string;
  status: CalorieStatus;
  unit: string;
  /** Partiel day: make the value an inline kcal input writing summary_kcal (B-079). */
  editable?: boolean;
  onSave?: (kcal: number) => void;
  placeholder?: string;
}

interface CalorieValueProps {
  value: number;
  unit: string;
  editable: boolean;
  onSave: ((kcal: number) => void) | undefined;
  placeholder: string | undefined;
}

/** The calorie total in the card footer: a read-only number, or an inline input on a Partiel
 *  day (commits on blur/Enter when finite, > 0 and changed — mirrors the Journal Calories cell). */
function CalorieValue({ value, unit, editable, onSave, placeholder }: CalorieValueProps) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : '');
  useEffect(() => {
    setDraft(value > 0 ? String(value) : '');
  }, [value]);

  if (!editable) {
    return (
      <span className={styles.val} data-testid="day-total-kcal">
        {Math.round(value)} {unit}
      </span>
    );
  }
  const commit = (): void => {
    const n = Number(draft.replace(',', '.'));
    if (onSave && Number.isFinite(n) && n > 0 && n !== value) onSave(n);
  };
  return (
    <span className={styles.val} data-testid="day-total-kcal">
      <input
        className={styles.valInput}
        value={draft}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />{' '}
      {unit}
    </span>
  );
}

export function CalorieCard({
  label,
  value,
  min,
  max,
  thresholdText,
  status,
  unit,
  editable = false,
  onSave,
  placeholder,
}: CalorieCardProps) {
  const top = max * 1.3 || 1;
  const p1 = (min / top) * 100;
  const p2 = (max / top) * 100;
  const fillPct = (Math.min(value, top) / top) * 100;
  const under = value < min;
  const over = value > max;
  const ok = !under && !over;
  // Always rendered red — both directions are off target (B-139).
  const gap = kcalGap(value, min, max);

  const fillColor = ok ? 'var(--in-band)' : under ? 'var(--under)' : 'var(--over)';
  const band = `linear-gradient(90deg,
    color-mix(in srgb, var(--under) 22%, transparent) 0 ${p1}%,
    color-mix(in srgb, var(--ok) 24%, transparent) ${p1}% ${p2}%,
    color-mix(in srgb, var(--over) 22%, transparent) ${p2}% 100%)`;

  return (
    <div
      className={[
        styles.card,
        styles.kcal,
        ok ? styles.good : '',
        over ? styles.bad : '',
        under ? styles.under : '',
      ].join(' ')}
    >
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.thr}>{thresholdText}</span>
      </div>
      <div className={styles.bar} style={{ background: band }}>
        <span className={styles.fill} style={{ width: `${fillPct}%`, background: fillColor }} />
        <span className={styles.tick} style={{ left: `${p1}%` }} />
        <span className={styles.tick} style={{ left: `${p2}%` }} />
      </div>
      <div className={styles.bot}>
        <CalorieValue
          value={value}
          unit={unit}
          editable={editable}
          onSave={onSave}
          placeholder={placeholder}
        />
        <span className={styles.status}>
          {ok ? status.inBand : under ? status.under : status.over}
        </span>
        {gap !== null && (
          <span className={`${styles.ecart} ${styles.ecartBad}`}>{signedInt(gap)}</span>
        )}
      </div>
    </div>
  );
}
