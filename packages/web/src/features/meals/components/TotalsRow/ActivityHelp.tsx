import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_LABEL_KEYS, ACTIVITY_LEVELS } from '@macronome/shared';
import styles from '../../meals.module.css';

// "?" help affordance next to the day-activity selector (B-026). Opens a legend popover
// listing the five activity levels with a short description each; copy reuses the existing
// activity i18n strings. Closes on outside-click / Escape (modelled on VerdictBadge).
export function ActivityHelp() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div className={styles.actHelp} ref={ref}>
      <button
        type="button"
        className={styles.actHelpBtn}
        aria-label={t('meals.activity.help')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div
          className={styles.actHelpPop}
          role="dialog"
          aria-label={t('meals.activity.legendTitle')}
        >
          <h4>{t('meals.activity.legendTitle')}</h4>
          <ul>
            {ACTIVITY_LEVELS.map((lvl) => (
              <li key={lvl}>
                <span className={styles.actHelpName}>{t(ACTIVITY_LABEL_KEYS[lvl].label)}</span>
                <span className={styles.actHelpDesc}>
                  {t(ACTIVITY_LABEL_KEYS[lvl].description)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
