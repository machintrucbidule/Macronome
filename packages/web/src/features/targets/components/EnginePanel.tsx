import { useTranslation } from 'react-i18next';
import { TargetWarning, type EngineReadout, type TargetWarningCode } from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { Banner } from '../../../components/Banner/Banner';
import { MacroFloorTiles } from './MacroFloorTiles';
import { DeficitBar } from './DeficitBar';
import { grams1, kcal, multiplier2, rate2, signedKcal } from '../format';
import styles from '../targets.module.css';

// Right column — "Moteur métabolique" (computed). Every figure comes from GET /target;
// the web only rounds for display. Weight-dependent tiles read "—" until there is a
// weigh-in; empirical burn needs logged days (M3) and stays "—" in M2.
const DASH = '—';
const showKcal = (n: number | null): string => (n === null ? DASH : kcal(n));

interface EnginePanelProps {
  engine: EngineReadout;
  warnings: TargetWarningCode[];
}

export function EnginePanel({ engine, warnings }: EnginePanelProps) {
  const { t } = useTranslation();
  const carbWarn = warnings.includes(TargetWarning.CarbCeilingNonPositive);
  const noWeight = warnings.includes(TargetWarning.NoWeight);
  const activityFallback = warnings.includes(TargetWarning.InsufficientActivityData);

  return (
    <section className={styles.column}>
      <header className={styles.colHead}>
        <h2>{t('targets.engine.title')}</h2>
        <span className={styles.badge}>{t('targets.badge.computed')}</span>
      </header>

      <div className={styles.readout}>
        <span>
          {t('targets.engine.currentWeight')}:{' '}
          <b>
            {engine.current_weight_kg === null ? DASH : `${grams1(engine.current_weight_kg)} kg`}
          </b>
        </span>
        <span>
          {t('targets.engine.age')}: <b>{engine.age ?? DASH}</b>
        </span>
        <span>
          {t('targets.engine.recentActivity')}:{' '}
          <b>
            {engine.recent_avg_activity === null ? DASH : multiplier2(engine.recent_avg_activity)}
          </b>
          {activityFallback && (
            <span className="hint"> {t('targets.engine.activityFallback')}</span>
          )}
        </span>
      </div>

      {noWeight && <Banner tone="warning">{t('targets.warning.noWeight')}</Banner>}

      <MacroFloorTiles engine={engine} carbWarn={carbWarn} />

      {carbWarn && <Banner tone="warning">{t('targets.warning.carb')}</Banner>}

      <div className={styles.tiles2}>
        <MetricCard
          size="md"
          label={t('targets.engine.bmr')}
          value={showKcal(engine.bmr)}
          unit="kcal/j"
        />
        <MetricCard
          size="md"
          label={t('targets.engine.estimatedBurn')}
          value={showKcal(engine.estimated_burn)}
          unit="kcal/j"
        />
        <MetricCard
          size="md"
          label={t('targets.engine.empiricalBurn')}
          value={showKcal(engine.empirical_burn)}
          unit="kcal/j"
          note={t('targets.engine.empiricalNote')}
        />
        <MetricCard
          size="md"
          tone={
            engine.deficit_at_target === null
              ? 'default'
              : engine.deficit_at_target <= 0
                ? 'good'
                : 'bad'
          }
          label={t('targets.engine.deficitAtTarget')}
          value={engine.deficit_at_target === null ? DASH : signedKcal(engine.deficit_at_target)}
          unit="kcal/j"
          note={
            engine.kg_per_week === null
              ? undefined
              : t('targets.engine.kgPerWeek', { value: rate2(engine.kg_per_week) })
          }
        />
      </div>

      <DeficitBar engine={engine} />
    </section>
  );
}
