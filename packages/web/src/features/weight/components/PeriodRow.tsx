import { useTranslation } from 'react-i18next';
import type { Period } from '@macronome/shared';
import { DASH, bmi1, kcal0, kg1, mult2, orDash, signed1, signedKcal0 } from '../format';
import styles from '../weight.module.css';

// One period row (screens/weight.md §Period table). All figures are server-derived; the row
// only formats. Clicking it edits the period's ending weigh-in (resolved by the page).
export function PeriodRow({ period, onClick }: { period: Period; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <tr className={styles.periodRow} data-period={period.end_date} onClick={onClick}>
      <td>{`${period.start_date} → ${period.end_date}`}</td>
      <td className={styles.num}>{period.days}</td>
      <td className={styles.num}>{kg1(period.weight_end)}</td>
      <td className={styles.num}>{kg1(period.ema)}</td>
      <td className={styles.num}>{signed1(period.delta)}</td>
      <td className={styles.num}>{orDash(period.ecart_trajectoire, signed1)}</td>
      <td className={styles.num}>{orDash(period.bmi, bmi1)}</td>
      <td className={styles.num}>{orDash(period.waist, kg1)}</td>
      <td className={styles.num}>{orDash(period.avg_intake, kcal0)}</td>
      <td className={styles.num}>{orDash(period.estimated_burn, kcal0)}</td>
      <td className={styles.num}>{orDash(period.empirical_burn, kcal0)}</td>
      <td className={styles.num}>{orDash(period.deficit_per_day, signedKcal0)}</td>
      <td className={styles.num}>{orDash(period.avg_activity, mult2)}</td>
      <td>{t(`weight.flag.${period.diet_flag}`)}</td>
      <td>{period.note ?? DASH}</td>
    </tr>
  );
}
