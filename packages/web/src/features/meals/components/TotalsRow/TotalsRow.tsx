import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { CalorieCard } from '../../../../components/MetricCard/CalorieCard';
import { MacroCard } from '../../../../components/MetricCard/MacroCard';
import { formatInt } from '../../../../lib/format/number';
import { VerdictCluster } from './VerdictCluster';
import styles from '../../meals.module.css';

// The day totals: calorie band card + three macro floor/ceiling cards + the verdict cluster.
// Every figure (totals, target snapshot, verdicts, constat) is server-computed; this renders it.
interface TotalsRowProps {
  day: DayDetail;
}

export function TotalsRow({ day }: TotalsRowProps) {
  const { t } = useTranslation();
  const s = day.target_snapshot;
  const macroStatus = { ok: t('meals.status.ok'), bad: t('meals.status.sous') };

  return (
    <div className={styles.totals}>
      <CalorieCard
        label={t('meals.card.calories')}
        value={day.totals.kcal}
        min={s.cal_min}
        max={s.cal_max}
        thresholdText={t('meals.card.calorieTarget', { min: s.cal_min, max: s.cal_max })}
        status={{
          inBand: t('meals.status.inBand'),
          under: t('meals.status.sous'),
          over: t('meals.status.over'),
        }}
        unit="kcal"
      />
      <MacroCard
        label={t('meals.card.fat')}
        value={day.totals.fat}
        threshold={s.fat_floor_g}
        mode="floor"
        thresholdText={
          s.fat_floor_g === null ? '—' : t('meals.card.min', { n: formatInt(s.fat_floor_g) })
        }
        status={macroStatus}
        unit="g"
      />
      <MacroCard
        label={t('meals.card.carb')}
        value={day.totals.carb}
        threshold={s.carb_ceiling_g}
        mode="ceiling"
        thresholdText={
          s.carb_ceiling_g === null ? '—' : t('meals.card.max', { n: formatInt(s.carb_ceiling_g) })
        }
        status={{ ok: t('meals.status.ok'), bad: t('meals.status.depasse') }}
        unit="g"
      />
      <MacroCard
        label={t('meals.card.protein')}
        value={day.totals.protein}
        threshold={s.protein_floor_g}
        mode="floor"
        thresholdText={
          s.protein_floor_g === null
            ? '—'
            : t('meals.card.min', { n: formatInt(s.protein_floor_g) })
        }
        status={macroStatus}
        unit="g"
      />
      <VerdictCluster
        activityLevel={day.activity_level}
        effective={day.effective_verdict}
        auto={day.verdict_auto}
        override={day.verdict_override}
        constat={day.constat}
      />
    </div>
  );
}
