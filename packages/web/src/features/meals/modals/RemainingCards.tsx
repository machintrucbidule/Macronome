import { useTranslation } from 'react-i18next';
import { type RemainingPreview } from '../logic/remainingPreview';
import { formatInt } from '../../../lib/format/number';
import styles from './modals.module.css';

// The day-wide remaining-target cards (kcal / P / L / G), shared by the "Proposition IA" request
// popup (state 2) and the refine panel's "Cibles inchangées" block (state 5, B-123). Display only:
// the framing comes from `previewRemaining` (CLAUDE.md rule 2 — the authoritative remaining stays
// server-computed in the response).
export function RemainingCards({ rem }: { rem: RemainingPreview }) {
  const { t } = useTranslation();
  const none = t('meals.proposals.remaining.none');
  const floor = (n: number | null): string =>
    n === null ? none : t('meals.proposals.remaining.floor', { n: formatInt(n) });
  const ceiling = (n: number | null): string =>
    n === null ? none : t('meals.proposals.remaining.ceiling', { n: formatInt(n) });
  return (
    <div className={styles.remainCards}>
      <div className={styles.remainCard}>
        <span className={styles.remainLabel}>{t('meals.proposals.remaining.calories')}</span>
        <span
          className={styles.remainValue}
        >{`${formatInt(rem.calMin)}–${formatInt(rem.calMax)}`}</span>
        <span className={styles.remainUnit}>{t('meals.proposals.remaining.caloriesUnit')}</span>
      </div>
      <div className={styles.remainCard}>
        <span className={styles.remainLabel}>{t('meals.proposals.remaining.protein')}</span>
        <span className={styles.remainValue}>{floor(rem.needProtein)}</span>
        <span className={styles.remainUnit}>{t('meals.proposals.remaining.floorUnit')}</span>
      </div>
      <div className={styles.remainCard}>
        <span className={styles.remainLabel}>{t('meals.proposals.remaining.fat')}</span>
        <span className={styles.remainValue}>{floor(rem.needFat)}</span>
        <span className={styles.remainUnit}>{t('meals.proposals.remaining.floorUnit')}</span>
      </div>
      <div className={styles.remainCard}>
        <span className={styles.remainLabel}>{t('meals.proposals.remaining.carb')}</span>
        <span className={styles.remainValue}>{ceiling(rem.carbRoom)}</span>
        <span className={styles.remainUnit}>{t('meals.proposals.remaining.ceilingUnit')}</span>
      </div>
    </div>
  );
}
