import { useTranslation } from 'react-i18next';
import {
  TargetWarning,
  type EngineReadout,
  type Profile,
  type TargetWarningCode,
} from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { Banner } from '../../../components/Banner/Banner';
import { ProfileForm } from './ProfileForm';
import { grams1, kcal, macroG, multiplier2, rate2, signedKcal } from '../format';
import styles from '../cibles.module.css';

// Right column — "Moteur métabolique" (computed). Every figure comes from GET /target;
// the web only rounds for display. Weight-dependent tiles read "—" until there is a
// weigh-in; empirical burn needs logged days (M3) and stays "—" in M2.
const DASH = '—';
const showG = (n: number | null): string => (n === null ? DASH : macroG(n));
const showKcal = (n: number | null): string => (n === null ? DASH : kcal(n));

interface EnginePanelProps {
  engine: EngineReadout;
  warnings: TargetWarningCode[];
  profile: Profile;
}

export function EnginePanel({ engine, warnings, profile }: EnginePanelProps) {
  const { t } = useTranslation();
  const carbWarn = warnings.includes(TargetWarning.CarbCeilingNonPositive);
  const noWeight = warnings.includes(TargetWarning.NoWeight);
  const activityFallback = warnings.includes(TargetWarning.InsufficientActivityData);

  return (
    <section className={styles.column}>
      <header className={styles.colHead}>
        <h2>{t('cibles.engine.title')}</h2>
        <span className={styles.badge}>{t('cibles.badge.computed')}</span>
      </header>

      <ProfileForm profile={profile} />

      <div className={styles.readout}>
        <span>
          {t('cibles.engine.currentWeight')}:{' '}
          <b>
            {engine.current_weight_kg === null ? DASH : `${grams1(engine.current_weight_kg)} kg`}
          </b>
        </span>
        <span>
          {t('cibles.engine.age')}: <b>{engine.age ?? DASH}</b>
        </span>
        <span>
          {t('cibles.engine.recentActivity')}:{' '}
          <b>
            {engine.recent_avg_activity === null ? DASH : multiplier2(engine.recent_avg_activity)}
          </b>
          {activityFallback && <span className="hint"> {t('cibles.engine.activityFallback')}</span>}
        </span>
      </div>

      {noWeight && <Banner tone="warning">{t('cibles.warning.noWeight')}</Banner>}

      <div className={styles.tiles3}>
        <MetricCard
          label={t('cibles.engine.proteinFloor')}
          value={showG(engine.protein_floor_g)}
          unit="g"
          note={t('cibles.engine.floorNote')}
        />
        <MetricCard
          label={t('cibles.engine.fatFloor')}
          value={showG(engine.fat_floor_g)}
          unit="g"
        />
        <MetricCard
          label={t('cibles.engine.carbCeiling')}
          value={showG(engine.carb_ceiling_g)}
          unit="g"
          tone={carbWarn ? 'warn' : 'default'}
        />
      </div>

      {carbWarn && <Banner tone="warning">{t('cibles.warning.carb')}</Banner>}

      <div className={styles.tiles2}>
        <MetricCard label={t('cibles.engine.bmr')} value={showKcal(engine.bmr)} unit="kcal/j" />
        <MetricCard
          label={t('cibles.engine.estimatedBurn')}
          value={showKcal(engine.estimated_burn)}
          unit="kcal/j"
        />
        <MetricCard
          label={t('cibles.engine.empiricalBurn')}
          value={showKcal(engine.empirical_burn)}
          unit="kcal/j"
          note={t('cibles.engine.empiricalNote')}
        />
        <MetricCard
          label={t('cibles.engine.deficitAtTarget')}
          value={engine.deficit_at_target === null ? DASH : signedKcal(engine.deficit_at_target)}
          unit="kcal/j"
          note={
            engine.kg_per_week === null
              ? undefined
              : t('cibles.engine.kgPerWeek', { value: rate2(engine.kg_per_week) })
          }
        />
      </div>
    </section>
  );
}
