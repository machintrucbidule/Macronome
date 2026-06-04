import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '@macronome/shared';
import styles from './VerdictBadge.module.css';

// Day calorie verdict (design/components/badges-verdict.md §A + §C). Clickable badge showing
// the effective verdict + an `auto`/`forcé` sub-label, opening a menu to force OK/NOK or revert
// to auto. The verdict itself is computed server-side; this only displays it and emits the
// chosen override (null = revert to auto).

export interface VerdictLabels {
  forceOk: string;
  forceNok: string;
  /** Receives the auto value to annotate, e.g. "Calcul auto (OK)". */
  autoCalc: (auto: Verdict | null) => string;
  auto: string;
  forced: string;
}

interface VerdictBadgeProps {
  effective: Verdict | null;
  auto: Verdict | null;
  override: Verdict | null;
  labels: VerdictLabels;
  onSet: (override: Verdict | null) => void;
}

export function VerdictBadge({ effective, auto, override, labels, onSet }: VerdictBadgeProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (effective === null) {
    return <div className={`${styles.badge} ${styles.muted}`}>—</div>;
  }

  const choose = (v: Verdict | null): void => {
    onSet(v);
    setOpen(false);
  };
  const options: { value: Verdict | null; label: string }[] = [
    { value: 'OK', label: labels.forceOk },
    { value: 'NOK', label: labels.forceNok },
    { value: null, label: labels.autoCalc(auto) },
  ];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.badge} ${effective === 'OK' ? styles.ok : styles.nok}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{effective}</span>
        <span className={styles.sub}>{override ? labels.forced : labels.auto}</span>
        <span className={styles.caret}>▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              className={o.value === override ? styles.cur : ''}
              onClick={() => choose(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
