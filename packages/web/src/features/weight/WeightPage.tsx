import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GetWeightResponse } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { RangeControl } from '../../components/Chart/RangeControl';
import { WeightChart } from '../../components/Chart/WeightChart';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { Cartouche } from './components/Cartouche';
import { PeriodTable } from './components/PeriodTable';
import { WeighInModal } from './components/WeighInModal';
import { WeightHeader } from './components/WeightHeader';
import { useWeight } from './useWeight';
import { useWeightController, type WeightController } from './useWeightController';
import styles from './weight.module.css';

// Poids screen (specifications/screens/weight.md): cartouche + chart + period table. Every
// figure is server-derived (rule 2); the screen renders, toggles the range/waist/mode, and
// edits weigh-ins through the modal. The current mode is ephemeral in M4 (persistence → M7).
function WeightBody({ data, ctl }: { data: GetWeightResponse; ctl: WeightController }) {
  const { t } = useTranslation();
  const c = data.cartouche;
  // Goal line is reconstructed from the cartouche for display (the contract carries the gap,
  // not the goal weight). Display-only — no nutrition figure is computed here.
  const goal = c.current !== null && c.gap_to_goal !== null ? c.current - c.gap_to_goal : null;
  const byDate = new Map(data.weigh_ins.map((w) => [w.date, w]));
  return (
    <div className={styles.layout}>
      <Cartouche data={c} />
      {data.weigh_ins.length > 0 ? (
        <WeightChart
          weighIns={data.weigh_ins}
          ema={data.ema}
          trajectory={data.trajectory}
          goal={goal}
          showWaist={ctl.showWaist}
          onToggleWaist={ctl.toggleWaist}
          range={ctl.range}
          onRange={ctl.setRange}
        />
      ) : (
        <div className={styles.rangeEmpty}>
          <RangeControl range={ctl.range} onRange={ctl.setRange} />
          <EmptyState>{t('weight.rangeEmpty')}</EmptyState>
        </div>
      )}
      {data.periods.length > 0 ? (
        <PeriodTable
          periods={data.periods}
          onRowClick={(d) => {
            const w = byDate.get(d);
            if (w) ctl.openEdit(w);
          }}
        />
      ) : (
        <EmptyState>{t('weight.single')}</EmptyState>
      )}
    </div>
  );
}

export function WeightPage() {
  const { t } = useTranslation();
  const ctl = useWeightController();
  const query = useWeight(ctl.range);
  const { mode, setMode } = ctl;
  const serverMode = query.data?.current_mode ?? null;

  // Seed the screen-local mode from the server default once (latest period's flag).
  useEffect(() => {
    if (mode === null && serverMode) setMode(serverMode);
  }, [mode, setMode, serverMode]);

  const empty = query.data && query.data.cartouche.current === null;
  return (
    <AppShell>
      <WeightHeader mode={mode} onMode={setMode} onAdd={ctl.openAdd} />
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data || empty ? (
        <EmptyState>{t('weight.empty')}</EmptyState>
      ) : (
        <WeightBody data={query.data} ctl={ctl} />
      )}
      {ctl.modal && (
        <WeighInModal target={ctl.modal} defaultFlag={mode ?? 'in_diet'} onClose={ctl.closeModal} />
      )}
    </AppShell>
  );
}
