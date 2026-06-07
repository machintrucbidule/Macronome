import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeals } from '../../MealsContext';
import { ConvertToSummaryConfirm } from './ConvertToSummaryConfirm';
import styles from './DayKindBadge.module.css';

// Day-kind chip + menu (design/components/badges-verdict.md §D, DK-1 / B-078). Replaces the
// inert DayTypeTag: a clickable pill (green Complet / yellow Partiel) opening a menu that
// switches the kind both ways. Complet -> Partiel on a day with food (confirmNeeded) goes
// through a strong confirm first; the conversions themselves are server-side.
interface Props {
  kind: 'detailed' | 'summary';
  /** True when switching to Partiel would discard food (detailed day with Σ>0) → confirm. */
  confirmNeeded: boolean;
}

export function DayKindBadge({ kind, confirmNeeded }: Props) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
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

  const pickDetailed = (): void => {
    setOpen(false);
    if (kind !== 'detailed') void actions.convertToDetailed();
  };
  const pickSummary = (): void => {
    setOpen(false);
    if (kind === 'summary') return;
    if (confirmNeeded) setConfirming(true);
    else void actions.convertToSummary();
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.chip} ${kind === 'detailed' ? styles.complet : styles.partiel}`}
        title={t('meals.dayType.switch')}
        aria-label={t('meals.dayType.switch')}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{t(`meals.dayType.${kind}`)}</span>
        <span className={styles.caret}>▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={kind === 'detailed' ? styles.cur : ''}
            onClick={pickDetailed}
          >
            {t('meals.dayType.detailed')}
          </button>
          <button
            type="button"
            className={kind === 'summary' ? styles.cur : ''}
            onClick={pickSummary}
          >
            {t('meals.dayType.summary')}
          </button>
        </div>
      )}
      {confirming && (
        <ConvertToSummaryConfirm
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void actions.convertToSummary();
          }}
        />
      )}
    </div>
  );
}
