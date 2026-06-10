import { useTranslation } from 'react-i18next';
import type { GetWeightResponse } from '@macronome/shared';
import { RangeControl } from '../../../components/Chart/RangeControl';
import { WeightChart } from '../../../components/Chart/WeightChart';
import { EmptyState } from '../../../components/states/EmptyState';
import { Cartouche } from './Cartouche';
import type { WeightController } from '../useWeightController';
import styles from '../weight.module.css';

// Cartouche + chart block, shared verbatim by the desktop and mobile Poids trees (mobile-
// responsive S8). Extracted from the former WeightBody so the render-switch branches don't
// duplicate it; the rendered DOM is identical on desktop. The chart keeps its own range +
// waist controls (owner decision 2026-06-10 — they stay on the chart on mobile too); the
// cartouche grid restyles to full-width ≤560px via weight.module.css. Render-only (rule 2).
export function WeightOverview({ data, ctl }: { data: GetWeightResponse; ctl: WeightController }) {
  const { t } = useTranslation();
  const c = data.cartouche;
  // Goal line is reconstructed from the cartouche for display (the contract carries the gap,
  // not the goal weight). Display-only — no nutrition figure is computed here.
  const goal = c.current !== null && c.gap_to_goal !== null ? c.current - c.gap_to_goal : null;
  return (
    <>
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
    </>
  );
}
