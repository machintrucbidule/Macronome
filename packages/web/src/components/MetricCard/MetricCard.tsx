import type { ReactNode } from 'react';
import styles from './MetricCard.module.css';

// Derived-value tile (design/components — Cibles "calculé" tiles). Pure presentational:
// a label, a value (already formatted by the caller), an optional unit + note. The web
// renders server-computed figures; it never computes them here.
interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  /**
   * Value tint: 'warn' for an inconsistent figure (e.g. carb ceiling ≤ 0); 'good'/'bad'
   * for a state-coloured figure (e.g. Cibles deficit green / surplus red — targets mockup).
   */
  tone?: 'default' | 'warn' | 'good' | 'bad';
  /** Macro accent: a coloured top border identifying the derived-macro tile (Cibles mockup). */
  accent?: 'prot' | 'fat' | 'carb';
  /**
   * Size variant (mockups draw three treatments from this one component):
   * default → 18px value on bg-elev-2 (Stats key figures);
   * 'md' → 20px (Cibles tiles); 'stat' → 24px value on bg-elev / r-lg
   * (Stats rolling strip, Poids cartouche).
   */
  size?: 'md' | 'stat';
}

const toneClass: Record<NonNullable<MetricCardProps['tone']>, string | undefined> = {
  default: undefined,
  warn: 'warn',
  good: 'good',
  bad: 'bad',
};

export function MetricCard({
  label,
  value,
  unit,
  note,
  tone = 'default',
  accent,
  size,
}: MetricCardProps) {
  const cardClass = [styles.card, size ? styles[size] : '', accent ? styles[accent] : '']
    .filter(Boolean)
    .join(' ');
  const valueTone = toneClass[tone];
  return (
    <div className={cardClass}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${valueTone ? styles[valueTone] : ''}`}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}
