import { useTranslation } from 'react-i18next';
import { type ActivityLevel, type DayConstat } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { ActivitySelect } from '../../../../components/ActivitySelect/ActivitySelect';
import { ActivityHelp } from './ActivityHelp';
import { r0 } from '../../format';
import { formatFixed } from '../../../../lib/format/number';
import styles from '../../meals.module.css';

// Verdict cluster: per-day activity select + the burn/deficit constat. The OK/NOK badge moved
// to the header date line (B-064). All values are server-computed; the cluster only displays
// them and emits the activity change.
interface VerdictClusterProps {
  activityLevel: string;
  constat: DayConstat;
}

export function VerdictCluster({ activityLevel, constat }: VerdictClusterProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();

  return (
    <div className={styles.verdict}>
      <div className={styles.actWrap}>
        <div className={styles.actHead}>
          <span className={styles.actLabel}>{t('meals.activity.label')}</span>
          <ActivityHelp perLevelBurn={constat.per_level_activity_burn} />
        </div>
        <ActivitySelect
          value={activityLevel as ActivityLevel}
          onChange={(lvl) => void actions.setActivity(lvl)}
          ariaLabel={t('meals.activity.label')}
        />
      </div>

      <div className={styles.constat}>
        {constat.estimated_burn === null ? (
          t('meals.constat.noWeight')
        ) : (
          <>
            {t('meals.constat.burn')} <b>{r0(constat.estimated_burn)}</b> kcal ·{' '}
            <span
              className={`${styles.def} ${(constat.deficit ?? 0) <= 0 ? styles.neg : styles.pos}`}
            >
              {(constat.deficit ?? 0) > 0 ? '+' : ''}
              {r0(constat.deficit)} kcal
            </span>
            <br />
            {(constat.deficit ?? 0) <= 0
              ? t('meals.constat.deficit')
              : t('meals.constat.surplus')}{' '}
            {(constat.kg_per_week ?? 0) > 0 ? '+' : ''}
            {formatFixed(constat.kg_per_week ?? 0, 2)} {t('meals.constat.kgPerWeek')}
          </>
        )}
      </div>
    </div>
  );
}
