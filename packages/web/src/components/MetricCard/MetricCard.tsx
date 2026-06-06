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
  /** 'warn' tints the value when the figure is inconsistent (e.g. carb ceiling ≤ 0). */
  tone?: 'default' | 'warn';
  /** Macro accent: a coloured top border identifying the derived-macro tile (Cibles mockup). */
  accent?: 'prot' | 'fat' | 'carb';
}

export function MetricCard({
  label,
  value,
  unit,
  note,
  tone = 'default',
  accent,
}: MetricCardProps) {
  const cardClass = [styles.card, accent ? styles[accent] : ''].filter(Boolean).join(' ');
  return (
    <div className={cardClass}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${tone === 'warn' ? styles.warn : ''}`}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}
