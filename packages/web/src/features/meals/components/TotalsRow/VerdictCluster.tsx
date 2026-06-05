import { useTranslation } from 'react-i18next';
import {
  ACTIVITY_LABEL_KEYS,
  ACTIVITY_LEVELS,
  type ActivityLevel,
  type DayConstat,
  type Verdict,
} from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { VerdictBadge } from '../../../../components/VerdictBadge/VerdictBadge';
import { r0 } from '../../format';
import { formatFixed } from '../../../../lib/format/number';
import styles from '../../meals.module.css';

// Verdict cluster: per-day activity select + the OK/NOK badge (with override menu) + the
// burn/deficit constat. All values are server-computed; the cluster only displays them and
// emits the activity / override change.
interface VerdictClusterProps {
  activityLevel: string;
  effective: Verdict | null;
  auto: Verdict | null;
  override: Verdict | null;
  constat: DayConstat;
}

export function VerdictCluster({
  activityLevel,
  effective,
  auto,
  override,
  constat,
}: VerdictClusterProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();

  const labels = {
    forceOk: t('meals.verdict.forceOk'),
    forceNok: t('meals.verdict.forceNok'),
    autoCalc: (a: Verdict | null) =>
      a ? t('meals.verdict.autoCalcWith', { v: a }) : t('meals.verdict.autoCalc'),
    auto: t('meals.verdict.auto'),
    forced: t('meals.verdict.forced'),
  };

  return (
    <div className={styles.verdict}>
      <div className={styles.actWrap}>
        <span className={styles.actLabel}>{t('meals.activity.label')}</span>
        <select
          className={styles.actSelect}
          value={activityLevel}
          onChange={(e) => void actions.setActivity(e.target.value as ActivityLevel)}
        >
          {ACTIVITY_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {t(ACTIVITY_LABEL_KEYS[lvl].label)}
            </option>
          ))}
        </select>
      </div>

      <VerdictBadge
        effective={effective}
        auto={auto}
        override={override}
        labels={labels}
        onSet={(v) => void actions.setVerdict(v)}
      />

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
