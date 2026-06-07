import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonthlyStat, TargetZone } from '@macronome/shared';
import { ChartGridlines } from '../../../components/Chart/ChartGridlines';
import { ChartLegend, type Series } from '../../../components/Chart/ChartLegend';
import { ChartTooltip, type TooltipPoint } from '../../../components/Chart/ChartTooltip';
import { ColumnHits, type ColumnHit } from '../../../components/Chart/ColumnHits';
import { type ChartBox, linear, niceDomain, polyline } from '../../../components/Chart/scale';
import { monthLabel, r0 } from '../format';
import chart from '../../../components/Chart/Chart.module.css';
import styles from '../stats.module.css';

// Average calories per month, split OK/NOK (spec/logic/stats-adherence.md §5): two grouped
// bars per month over the shaded target band [cal_min, cal_max], plus the global-average
// polyline + dots in var(--text) (B-111). Left kcal axis + gridlines + legend (B-112) and a
// styled per-month tooltip (B-111). Inline SVG, semantic tokens only; averages are
// server-computed (full precision), shown rounded to integer kcal.

const W = 720;
const H = 220;
const PAD = { l: 40, r: 8, t: 12, b: 22 };
const BOX: ChartBox = { w: W, h: H, padL: PAD.l, padR: PAD.r, padT: PAD.t, padB: PAD.b };

const LEGEND: Series[] = [
  { shape: 'dot', token: '--ok', labelKey: 'stats.legend.avgOk' },
  { shape: 'dot', token: '--nok', labelKey: 'stats.legend.avgNok' },
  { shape: 'line', token: '--text', labelKey: 'stats.legend.avgGlobal' },
  { shape: 'dot', token: '--accent', labelKey: 'stats.legend.zone' },
];

/** One month: OK/NOK bars (when present), the month label, and the global-average dot. */
function AvgBarGroup({
  m,
  cx,
  barW,
  base,
  y,
  lang,
}: {
  m: MonthlyStat;
  cx: number;
  barW: number;
  base: number;
  y: (v: number) => number;
  lang: string;
}) {
  return (
    <g>
      {m.avg_kcal_ok !== null && (
        <rect
          className={styles.barOk}
          x={cx - barW - 1}
          y={y(m.avg_kcal_ok)}
          width={barW}
          height={base - y(m.avg_kcal_ok)}
        />
      )}
      {m.avg_kcal_nok !== null && (
        <rect
          className={styles.barNok}
          x={cx + 1}
          y={y(m.avg_kcal_nok)}
          width={barW}
          height={base - y(m.avg_kcal_nok)}
        />
      )}
      <text className={styles.axis} x={cx} y={H - 8}>
        {monthLabel(m.month, lang)}
      </text>
      <circle className={styles.avgDot} cx={cx} cy={y(m.avg_kcal_global)} r={2.4} />
    </g>
  );
}

export function MonthCalorieBars({
  monthly,
  zone,
}: {
  monthly: MonthlyStat[];
  zone: TargetZone | null;
}) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<TooltipPoint | null>(null);
  const base = H - PAD.b;
  const values = monthly.flatMap((m) =>
    [m.avg_kcal_ok, m.avg_kcal_nok, m.avg_kcal_global].filter((v): v is number => v !== null),
  );
  if (zone) values.push(zone.cal_min, zone.cal_max);
  const [lo, hi] = niceDomain(values.length ? values : [0, 1]);
  const y = linear(lo, hi, base, PAD.t);
  const slot = (W - PAD.l - PAD.r) / Math.max(monthly.length, 1);
  const barW = Math.min(slot * 0.28, 16);
  const cxOf = (i: number): number => PAD.l + slot * i + slot / 2;
  const globalPath = polyline(monthly.map((m, i) => ({ x: cxOf(i), y: y(m.avg_kcal_global) })));

  const tipFor = (m: MonthlyStat): string =>
    `${monthLabel(m.month, i18n.language)} · OK ${r0(m.avg_kcal_ok)} · NOK ${r0(
      m.avg_kcal_nok,
    )} · ${t('stats.legend.avgGlobal')} ${r0(m.avg_kcal_global)} kcal`;
  const columns: ColumnHit[] = monthly.map((m, i) => ({
    x: PAD.l + slot * i,
    point: { cx: cxOf(i), cy: y(m.avg_kcal_global), tip: tipFor(m) },
  }));

  return (
    <div className={chart.chart}>
      <div className={chart.plot}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={styles.bars}>
          <ChartGridlines box={BOX} lo={lo} hi={hi} y={y} />
          {zone && (
            <rect
              className={styles.zone}
              x={PAD.l}
              y={y(zone.cal_max)}
              width={W - PAD.l - PAD.r}
              height={Math.max(0, y(zone.cal_min) - y(zone.cal_max))}
            />
          )}
          {monthly.map((m, i) => (
            <AvgBarGroup
              key={m.month}
              m={m}
              cx={cxOf(i)}
              barW={barW}
              base={base}
              y={y}
              lang={i18n.language}
            />
          ))}
          {globalPath && <path className={styles.avgLine} d={globalPath} />}
          <ColumnHits
            columns={columns}
            width={slot}
            top={PAD.t}
            height={base - PAD.t}
            onHover={setHovered}
            onLeave={() => setHovered(null)}
          />
        </svg>
        {hovered && <ChartTooltip point={hovered} box={BOX} />}
      </div>
      <ChartLegend series={LEGEND} />
    </div>
  );
}
