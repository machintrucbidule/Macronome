import styles from './BandCard.module.css';

// Wide calorie card with the three-zone target band (design/components/metric-cards.md).
// The value (day kcal) and the band (cal_min/cal_max) come from the server; this only
// positions the bar and picks the status word — it is not the authoritative day verdict.

interface CalorieStatus {
  inBand: string;
  under: string;
  over: string;
}

interface CalorieCardProps {
  label: string;
  value: number;
  min: number;
  max: number;
  thresholdText: string;
  status: CalorieStatus;
  unit: string;
}

export function CalorieCard({
  label,
  value,
  min,
  max,
  thresholdText,
  status,
  unit,
}: CalorieCardProps) {
  const top = max * 1.3 || 1;
  const p1 = (min / top) * 100;
  const p2 = (max / top) * 100;
  const fillPct = (Math.min(value, top) / top) * 100;
  const under = value < min;
  const over = value > max;
  const ok = !under && !over;

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
        <span className={styles.val}>
          {Math.round(value)} {unit}
        </span>
        <span className={styles.status}>
          {ok ? status.inBand : under ? status.under : status.over}
        </span>
      </div>
    </div>
  );
}
