import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeighIn, WeightPoint, WeightRange } from '@macronome/shared';
import { ChartAxes } from './ChartAxes';
import { ChartLegend, type Series } from './ChartLegend';
import { ChartTooltip, type TooltipAnchor } from './ChartTooltip';
import { HitAreas, type HitPoint } from './HitAreas';
import { RangeControl } from './RangeControl';
import { WEIGHT_BOX as B, linear, niceDomain, polyline, toMs } from './scale';
import { formatDate } from '../../features/stats/format';
import styles from './Chart.module.css';

// Weight chart (design/components/charts.md §Weight chart): one inline SVG, layered
// back-to-front (goal · trajectory · raw · EMA · dots · waist), every stroke a theme
// token (never baked hex). The maths is server-side; this only projects + renders.
const LEGEND: Series[] = [
  { shape: 'dot', token: '--weight', labelKey: 'weight.legend.weighed' },
  { shape: 'line', token: '--trend', labelKey: 'weight.legend.trend' },
  { shape: 'dash', token: '--traj', labelKey: 'weight.legend.trajectory' },
  { shape: 'dash', token: '--ok', labelKey: 'weight.legend.goal' },
];
const WAIST_LEGEND: Series = { shape: 'line', token: '--waistc', labelKey: 'weight.legend.waist' };
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
  const yDomain = niceDomain(ys);
  const wDomain = niceDomain(weighIns.filter((w) => w.waist_cm !== null).map((w) => w.waist_cm!));
  const xDomain: [number, number] = [Math.min(...xs), Math.max(...xs)];
  return {
    x: linear(xDomain[0], xDomain[1], B.padL, B.w - B.padR),
    y: linear(yDomain[0], yDomain[1], B.h - B.padB, B.padT),
    wy: linear(wDomain[0], wDomain[1], B.h - B.padB, B.padT),
    yDomain,
    wDomain,
    xDomain,
  };
}

/** Hoverable point list: weight dots, plus waist dots when the overlay is on. */
function buildHits(
  weighIns: WeighIn[],
  waistPts: WeighIn[],
  showWaist: boolean,
  x: (v: number) => number,
  y: (v: number) => number,
  wy: (v: number) => number,
  lang: string,
): HitPoint[] {
  return [
    ...weighIns.map((p) => ({
      id: `h-${p.id}`,
      cx: x(toMs(p.date)),
      cy: y(p.weight_kg),
      tip: { title: formatDate(p.date, lang), rows: [`${p.weight_kg} kg`] },
    })),
    ...(showWaist
      ? waistPts.map((p) => ({
          id: `wh-${p.id}`,
          cx: x(toMs(p.date)),
          cy: wy(p.waist_cm!),
          tip: { title: formatDate(p.date, lang), rows: [`${p.waist_cm} cm`] },
        }))
      : []),
  ];
}

export function WeightChart(props: WeightChartProps) {
  const { weighIns, ema, trajectory, goal, showWaist, onToggleWaist, range, onRange } = props;
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<TooltipAnchor | null>(null);
  const { x, y, wy, yDomain, wDomain, xDomain } = useMemo(
    () => buildScales(weighIns, ema, trajectory, goal),
    [weighIns, ema, trajectory, goal],
  );

  const emaPath = polyline(ema.map((p) => ({ x: x(toMs(p.date)), y: y(p.value) })));
  const trajPath = polyline(trajectory.map((p) => ({ x: x(toMs(p.date)), y: y(p.value) })));
  const rawPath = polyline(weighIns.map((p) => ({ x: x(toMs(p.date)), y: y(p.weight_kg) })));
  const waistPts = weighIns.filter((p) => p.waist_cm !== null);
  const waistPath = polyline(waistPts.map((p) => ({ x: x(toMs(p.date)), y: wy(p.waist_cm!) })));
  const goalY = goal !== null ? y(goal) : null;
  const hits = buildHits(weighIns, waistPts, showWaist, x, y, wy, i18n.language);

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
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${B.w} ${B.h}`}
          preserveAspectRatio="xMidYMid meet"
          className={styles.svg}
        >
          <ChartAxes
            box={B}
            yDomain={yDomain}
            y={y}
            xDomain={xDomain}
            x={x}
            showWaist={showWaist}
            wDomain={wDomain}
            wy={wy}
          />
          {goalY !== null && (
            <line className={styles.goal} x1={B.padL} x2={B.w - B.padR} y1={goalY} y2={goalY} />
          )}
          {trajPath && <path className={styles.traj} d={trajPath} />}
          {rawPath && <path className={styles.raw} d={rawPath} />}
          {emaPath && <path className={styles.ema} d={emaPath} />}
          {weighIns.map((p) => (
            <circle
              className={styles.pt}
              key={p.id}
              cx={x(toMs(p.date))}
              cy={y(p.weight_kg)}
              r={2.6}
            />
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
              />
            ))}
          <HitAreas points={hits} onHover={setHovered} onLeave={() => setHovered(null)} />
        </svg>
        {hovered && <ChartTooltip anchor={hovered} />}
      </div>
      <ChartLegend series={showWaist ? [...LEGEND, WAIST_LEGEND] : LEGEND} />
    </div>
  );
}
