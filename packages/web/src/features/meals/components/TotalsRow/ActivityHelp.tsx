import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_LABEL_KEYS, ACTIVITY_LEVELS } from '@macronome/shared';
import { r0 } from '../../format';
import styles from '../../meals.module.css';

// "?" help affordance next to the day-activity selector (B-026). Opens a legend popover
// listing the five levels with a real daily-activity example and the kcal/day FROM ACTIVITY
// (above BMR, server-computed) so the user can pick. kcal is hidden when there is no weigh-in
// yet (perLevelBurn null). Closes on outside-click / Escape (modelled on VerdictBadge).
interface ActivityHelpProps {
  /** kcal/day from activity (above BMR) per level, or null without a weigh-in. */
  perLevelBurn: Record<string, number> | null;
}

export function ActivityHelp({ perLevelBurn }: ActivityHelpProps) {
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
            {ACTIVITY_LEVELS.map((lvl) => {
              const kcal = perLevelBurn?.[lvl];
              return (
                <li key={lvl}>
                  <div className={styles.actHelpHead}>
                    <span className={styles.actHelpName}>{t(ACTIVITY_LABEL_KEYS[lvl].label)}</span>
                    {kcal != null && (
                      <span className={styles.actHelpKcal}>
                        {t('meals.activity.kcalPerDay', { n: r0(kcal) })}
                      </span>
                    )}
                  </div>
                  <span className={styles.actHelpDesc}>
                    {t(ACTIVITY_LABEL_KEYS[lvl].description)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
