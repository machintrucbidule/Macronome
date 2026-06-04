import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeighIn, WeightPoint, WeightRange } from '@macronome/shared';
import { ChartLegend } from './ChartLegend';
import { RangeControl } from './RangeControl';
import { WEIGHT_BOX as B, linear, niceDomain, polyline, toMs } from './scale';
import styles from './Chart.module.css';

// Weight chart (design/components/charts.md §Weight chart): one inline SVG, layered
// back-to-front (goal · trajectory · raw · EMA · dots · waist), every stroke a theme
// token (never baked hex). The maths is server-side; this only projects + renders.
interface WeightChartProps {
  weighIns: WeighIn[];
  ema: WeightPoint[];
  trajectory: WeightPoint[];
  /** Goal line value (reconstructed from the cartouche for display), or null. */
  goal: number | null;
  showWaist: boolean;
  onToggleWaist: () => void;
  range: WeightRange;
  onRange: (r: WeightRange) => void;
}

function buildScales(
  weighIns: WeighIn[],
  ema: WeightPoint[],
  trajectory: WeightPoint[],
  goal: number | null,
) {
  const xs = [...weighIns.map((w) => toMs(w.date)), ...ema.map((p) => toMs(p.date))];
  const ys = [
    ...weighIns.map((w) => w.weight_kg),
    ...ema.map((p) => p.value),
    ...trajectory.map((p) => p.value),
    ...(goal !== null ? [goal] : []),
  ];
  const [yMin, yMax] = niceDomain(ys);
  const [wMin, wMax] = niceDomain(
    weighIns.filter((w) => w.waist_cm !== null).map((w) => w.waist_cm!),
  );
  return {
    x: linear(Math.min(...xs), Math.max(...xs), B.padL, B.w - B.padR),
    y: linear(yMin, yMax, B.h - B.padB, B.padT),
    wy: linear(wMin, wMax, B.h - B.padB, B.padT),
  };
}

export function WeightChart(props: WeightChartProps) {
  const { weighIns, ema, trajectory, goal, showWaist, onToggleWaist, range, onRange } = props;
  const { t } = useTranslation();
  const { x, y, wy } = useMemo(
    () => buildScales(weighIns, ema, trajectory, goal),
    [weighIns, ema, trajectory, goal],
  );

  const emaPath = polyline(ema.map((p) => ({ x: x(toMs(p.date)), y: y(p.value) })));
  const trajPath = polyline(trajectory.map((p) => ({ x: x(toMs(p.date)), y: y(p.value) })));
  const rawPath = polyline(weighIns.map((p) => ({ x: x(toMs(p.date)), y: y(p.weight_kg) })));
  const waistPts = weighIns.filter((p) => p.waist_cm !== null);
  const waistPath = polyline(waistPts.map((p) => ({ x: x(toMs(p.date)), y: wy(p.waist_cm!) })));
  const goalY = goal !== null ? y(goal) : null;

  return (
    <div className={styles.chart} data-chart="weight">
      <div className={styles.chartHead}>
        <button
          type="button"
          className={showWaist ? styles.waistOn : styles.waistToggle}
          aria-pressed={showWaist}
          onClick={onToggleWaist}
        >
          {t('weight.waistToggle')}
        </button>
        <RangeControl range={range} onRange={onRange} />
      </div>
      <svg viewBox={`0 0 ${B.w} ${B.h}`} preserveAspectRatio="xMidYMid meet" className={styles.svg}>
        {goalY !== null && (
          <line className={styles.goal} x1={B.padL} x2={B.w - B.padR} y1={goalY} y2={goalY} />
        )}
        {trajPath && <path className={styles.traj} d={trajPath} />}
        {rawPath && <path className={styles.raw} d={rawPath} />}
        {emaPath && <path className={styles.ema} d={emaPath} />}
        {weighIns.map((p) => (
          <circle className={styles.pt} key={p.id} cx={x(toMs(p.date))} cy={y(p.weight_kg)} r={2.6}>
            <title>{`${p.date} · ${p.weight_kg} kg`}</title>
          </circle>
        ))}
        {showWaist && waistPath && <path className={styles.waist} d={waistPath} />}
        {showWaist &&
          waistPts.map((p) => (
            <circle
              className={styles.waistPt}
              key={`w-${p.id}`}
              cx={x(toMs(p.date))}
              cy={wy(p.waist_cm!)}
              r={2}
            >
              <title>{`${p.date} · ${p.waist_cm} cm`}</title>
            </circle>
          ))}
      </svg>
      <ChartLegend showWaist={showWaist} />
    </div>
  );
}
