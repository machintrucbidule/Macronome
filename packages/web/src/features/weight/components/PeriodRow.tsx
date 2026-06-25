import { useTranslation } from 'react-i18next';
import type { ActivityLevel, Period } from '@macronome/shared';
import { DASH, bmi1, kcal0, kg1, mult2, orDash, signed1, signedKcal0 } from '../format';
import { activityLevelFromMultiplier, deltaArrow, signTone, type Tone } from '../period-style';
import styles from '../weight.module.css';

// One period row (screens/weight.md §Period table). All figures are server-derived; the row
// only formats + picks a colour/arrow class (WV-1/B-115 — never computes). Clicking it edits
// the period's ending weigh-in (resolved by the page).

// avg_activity is a PAL multiplier → nearest level → palette class (mirrors ActivitySelect).
const LEVEL_CLASS: Record<ActivityLevel, string | undefined> = {
  sedentary: styles.sedentary,
  lightly_active: styles.lightly,
  moderately_active: styles.moderate,
  very_active: styles.veryActive,
  extremely_active: styles.extreme,
};

const toneClass = (tone: Tone): string =>
  (tone === 'pos' ? styles.pos : tone === 'neg' ? styles.neg : '') ?? '';

export function PeriodRow({ period, onClick }: { period: Period; onClick: () => void }) {
  const { t } = useTranslation();
  // The open interval (B-176) dashes the end-weight figures and ends at "today".
  const arrow = period.delta === null ? null : deltaArrow(period.delta);
  const end = period.open ? t('weight.today') : period.end_date;
  return (
    <tr className={styles.periodRow} data-period={period.end_date} onClick={onClick}>
      <td>{`${period.start_date} → ${end}`}</td>
      <td className={styles.num}>{period.days}</td>
      <td className={styles.num}>{orDash(period.weight_end, kg1)}</td>
      <td className={styles.num}>{orDash(period.ema, kg1)}</td>
      <td
        className={`${styles.num} ${period.delta === null ? '' : toneClass(signTone(period.delta))}`}
      >
        {arrow && <span className={styles.arrow}>{arrow}</span>}
        {orDash(period.delta, signed1)}
      </td>
      <td
        className={`${styles.num} ${period.ecart_trajectoire === null ? '' : toneClass(signTone(period.ecart_trajectoire))}`}
      >
        {orDash(period.ecart_trajectoire, signed1)}
      </td>
      <td className={styles.num}>{orDash(period.bmi, bmi1)}</td>
      <td className={styles.num}>{orDash(period.waist, kg1)}</td>
      <td className={styles.num}>{orDash(period.avg_intake, kcal0)}</td>
      <td className={styles.num}>{orDash(period.estimated_burn, kcal0)}</td>
      <td className={styles.num}>{orDash(period.empirical_burn, kcal0)}</td>
      <td
        className={`${styles.num} ${period.deficit_per_day === null ? '' : toneClass(signTone(period.deficit_per_day))}`}
      >
        {orDash(period.deficit_per_day, signedKcal0)}
      </td>
      <td className={styles.num}>
        {period.avg_activity === null ? (
          DASH
        ) : (
          <span
            className={`${styles.actTint} ${LEVEL_CLASS[activityLevelFromMultiplier(period.avg_activity)]}`}
          >
            {mult2(period.avg_activity)}
          </span>
        )}
      </td>
      <td>
        <span className={period.diet_flag === 'in_diet' ? styles.flagDiet : styles.flagMaint}>
          {t(`weight.flag.${period.diet_flag}`)}
        </span>
      </td>
      <td>{period.note ?? DASH}</td>
    </tr>
  );
}
