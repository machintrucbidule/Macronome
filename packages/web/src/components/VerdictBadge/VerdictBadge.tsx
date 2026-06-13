import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '@macronome/shared';
import { useMenuPlacement } from '../../lib/useMenuPlacement';
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
  /**
   * Whether the day is still in a real deficit (`intake ≤ estimated_burn`), derived by the caller
   * from the server figure (`burn_gap`/`constat.deficit ≤ 0`). When the verdict is NOK, `true`
   * tints the badge orange instead of red; `false`/`null` (surplus or unknown burn) stays red.
   * OK is unaffected (B-166). Never computed here — CLAUDE.md rule 2.
   */
  belowBurn?: boolean | null | undefined;
}

export function VerdictBadge({
  effective,
  auto,
  override,
  labels,
  onSet,
  belowBurn,
}: VerdictBadgeProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Keep the menu inside the clipping ancestor's horizontal edges so it is never cut off at a
  // screen/modal edge (B-168 — the Journal day-editor sheet). Vertical flip is not enabled here
  // (the 3-item verdict menu keeps dropping down; owner decision — only the activity select flips).
  const placement = useMenuPlacement(open, wrapRef, menuRef, 3);

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

  // Colour tone: OK → green; NOK → orange only when the day is in a deficit (belowBurn === true),
  // otherwise red (surplus or unknown burn) (B-166).
  const tone = effective === 'OK' ? styles.ok : belowBurn ? styles.warn : styles.nok;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.badge} ${tone}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{effective}</span>
        <span className={styles.sub}>{override ? labels.forced : labels.auto}</span>
        <span className={styles.caret}>▾</span>
      </button>
      {open && (
        <div
          className={styles.menu}
          role="menu"
          ref={menuRef}
          style={placement.left == null ? undefined : { left: placement.left, right: 'auto' }}
        >
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
