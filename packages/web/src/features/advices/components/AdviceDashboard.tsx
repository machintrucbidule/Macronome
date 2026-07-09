import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeightRange } from '@macronome/shared';
import { EnginePanel } from '../../targets/components/EnginePanel';
import { Cartouche } from '../../weight/components/Cartouche';
import { WeightChart } from '../../../components/Chart/WeightChart';
import { RollingCards } from '../../stats/components/RollingCards';
import { AdherenceSections } from '../../stats/components/AdherenceSections';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { currentYear } from '../../stats/format';
import { useTarget, useTargetHistory } from '../../targets/useTargets';
import { useWeight } from '../../weight/useWeight';
import { useRolling, useAdherence } from '../../stats/useStats';
import { AdviceTargetHistory } from './AdviceTargetHistory';
import styles from '../advices.module.css';

// Aggregated-data dashboard (B-202, block A): a read-only recap of what the AI is sent, ASSEMBLED
// from the existing read-services by REUSING their display components (CLAUDE.md rule 2 — the web
// never computes). Collapsible and COLLAPSED by default so the generate action stays front-and-centre
// (the recap is a "what the AI sees" detail, opened on demand). The raw 30-day journal / meal
// food-lines are NOT duplicated here (they live on Journal/Repas) but are still sent to the model.
export function AdviceDashboard() {
  const { t } = useTranslation();
  const target = useTarget();
  const history = useTargetHistory();
  const [range, setRange] = useState<WeightRange>('all');
  const [showWaist, setShowWaist] = useState(false);
  const weight = useWeight(range);
  const rolling = useRolling();
  const [year, setYear] = useState(currentYear());
  const adherence = useAdherence(year);

  const c = weight.data?.cartouche;
  // Goal line reconstructed from the cartouche for the chart (display-only, like WeightOverview).
  const goal = c && c.current !== null && c.gap_to_goal !== null ? c.current - c.gap_to_goal : null;

  return (
    <details className={styles.dashboard}>
      <summary className={styles.dashSummary}>{t('advices.dashboard')}</summary>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('advices.section.engine')}</h2>
        {target.data ? (
          <EnginePanel engine={target.data.engine} warnings={target.data.warnings} />
        ) : (
          <SkeletonRows />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('advices.section.targets')}</h2>
        {history.data ? <AdviceTargetHistory versions={history.data.versions} /> : <SkeletonRows />}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('advices.section.weight')}</h2>
        {weight.data && c ? (
          <>
            <Cartouche data={c} />
            {weight.data.weigh_ins.length > 0 && (
              <WeightChart
                weighIns={weight.data.weigh_ins}
                ema={weight.data.ema}
                trajectory={weight.data.trajectory}
                goal={goal}
                showWaist={showWaist}
                onToggleWaist={() => setShowWaist((s) => !s)}
                range={range}
                onRange={setRange}
              />
            )}
          </>
        ) : (
          <SkeletonRows />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{t('advices.section.rolling')}</h2>
        {rolling.data ? <RollingCards windows={rolling.data.windows} /> : <SkeletonRows />}
      </section>

      <AdherenceSections
        data={adherence.data}
        loading={adherence.isLoading}
        year={year}
        onYear={setYear}
      />
    </details>
  );
}
