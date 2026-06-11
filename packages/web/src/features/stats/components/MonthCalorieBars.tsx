import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonthlyStat } from '@macronome/shared';
import { ChartGridlines } from '../../../components/Chart/ChartGridlines';
import { ChartLegend, type Series } from '../../../components/Chart/ChartLegend';
import {
  ChartTooltip,
  type TipContent,
  type TooltipPoint,
} from '../../../components/Chart/ChartTooltip';
import { ColumnHits, type ColumnHit } from '../../../components/Chart/ColumnHits';
import { type ChartBox, linear, niceDomain, polyline } from '../../../components/Chart/scale';
import { monthLabel, r0 } from '../format';
import { ScrollBlock } from './ScrollBlock';
import chart from '../../../components/Chart/Chart.module.css';
import styles from '../stats.module.css';

// Average calories per month, split OK/NOK (spec/logic/stats-adherence.md §5): two grouped
// bars per month over the shaded target band [cal_min, cal_max], plus the global-average
// polyline + dots in var(--text) (B-111). The band is resolved per month from the target in
// effect then, so it steps across target changes (CZ-1/B-141). Left kcal axis + gridlines +
// legend (B-112) and a styled per-month tooltip (B-111). Inline SVG, semantic tokens only;
// averages are server-computed (full precision), shown rounded to integer kcal.

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

/** Structured per-month tooltip: month title + one avg-kcal value per line (CT-1/B-140). */
function tipFor(m: MonthlyStat, lang: string, t: (k: string) => string): TipContent {
  return {
    title: monthLabel(m.month, lang),
    rows: [
      `OK ${r0(m.avg_kcal_ok)}`,
      `NOK ${r0(m.avg_kcal_nok)}`,
      `${t('stats.legend.avgGlobal')} ${r0(m.avg_kcal_global)} kcal`,
    ],
  };
}

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

export function MonthCalorieBars({ monthly }: { monthly: MonthlyStat[] }) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<TooltipPoint | null>(null);
  const base = H - PAD.b;
  const values = monthly.flatMap((m) =>
    [
      m.avg_kcal_ok,
      m.avg_kcal_nok,
      m.avg_kcal_global,
      m.target_zone?.cal_min ?? null,
      m.target_zone?.cal_max ?? null,
    ].filter((v): v is number => v !== null),
  );
  const [lo, hi] = niceDomain(values.length ? values : [0, 1]);
  const y = linear(lo, hi, base, PAD.t);
  const slot = (W - PAD.l - PAD.r) / Math.max(monthly.length, 1);
  const barW = Math.min(slot * 0.28, 16);
  const cxOf = (i: number): number => PAD.l + slot * i + slot / 2;
  const globalPath = polyline(monthly.map((m, i) => ({ x: cxOf(i), y: y(m.avg_kcal_global) })));

  const columns: ColumnHit[] = monthly.map((m, i) => ({
    x: PAD.l + slot * i,
    point: { cx: cxOf(i), cy: y(m.avg_kcal_global), tip: tipFor(m, i18n.language, t) },
  }));

  return (
    <div className={chart.chart}>
      <ScrollBlock dep={monthly}>
        <div className={chart.plot}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className={styles.bars}
          >
            <ChartGridlines box={BOX} lo={lo} hi={hi} y={y} />
            {monthly.map((m, i) =>
              m.target_zone ? (
                <rect
                  key={m.month}
                  className={styles.zone}
                  x={PAD.l + slot * i}
                  y={y(m.target_zone.cal_max)}
                  width={slot}
                  height={Math.max(0, y(m.target_zone.cal_min) - y(m.target_zone.cal_max))}
                />
              ) : null,
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
      </ScrollBlock>
      <ChartLegend series={LEGEND} />
    </div>
  );
}
