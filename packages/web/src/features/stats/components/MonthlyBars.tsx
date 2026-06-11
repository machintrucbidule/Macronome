import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonthlyStat } from '@macronome/shared';
import { ChartGridlines } from '../../../components/Chart/ChartGridlines';
import { ChartLegend, type Series } from '../../../components/Chart/ChartLegend';
import { ChartTooltip, type TooltipPoint } from '../../../components/Chart/ChartTooltip';
import { ColumnHits, type ColumnHit } from '../../../components/Chart/ColumnHits';
import { type ChartBox, linear } from '../../../components/Chart/scale';
import { monthLabel, pct } from '../format';
import { ScrollBlock } from './ScrollBlock';
import chart from '../../../components/Chart/Chart.module.css';
import styles from '../stats.module.css';

// Monthly OK/NOK pivot (spec/logic/stats-adherence.md §4): one stacked bar per month —
// OK (green) over NOK (red), height ∝ logged days — with the OK% label. Left day-count axis
// + gridlines + legend (B-112) and a styled per-month tooltip (B-111). Inline SVG, semantic
// tokens only; counts/rate are server-computed, this only draws them.

const W = 720;
const H = 200;
const PAD = { l: 30, r: 8, t: 18, b: 22 };
const BOX: ChartBox = { w: W, h: H, padL: PAD.l, padR: PAD.r, padT: PAD.t, padB: PAD.b };

const LEGEND: Series[] = [
  { shape: 'dot', token: '--ok', labelKey: 'stats.legend.ok' },
  { shape: 'dot', token: '--nok', labelKey: 'stats.legend.nok' },
];

export function MonthlyBars({ monthly }: { monthly: MonthlyStat[] }) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<TooltipPoint | null>(null);
  const base = H - PAD.b;
  const maxTotal = Math.max(1, ...monthly.map((m) => m.ok_count + m.nok_count));
  const y = linear(0, maxTotal, base, PAD.t);
  const slot = (W - PAD.l - PAD.r) / Math.max(monthly.length, 1);
  const barW = Math.min(slot * 0.6, 34);
  const columns: ColumnHit[] = monthly.map((m, i) => ({
    x: PAD.l + slot * i,
    point: {
      cx: PAD.l + slot * i + slot / 2,
      cy: y(m.ok_count + m.nok_count),
      tip: {
        title: monthLabel(m.month, i18n.language),
        rows: [
          t('stats.monthly.tooltipOk', { ok: m.ok_count }),
          t('stats.monthly.tooltipNok', { nok: m.nok_count }),
        ],
      },
    },
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
            <ChartGridlines box={BOX} lo={0} hi={maxTotal} y={y} />
            {monthly.map((m, i) => {
              const x = PAD.l + slot * i + (slot - barW) / 2;
              const okH = base - y(m.ok_count);
              const nokH = base - y(m.nok_count);
              return (
                <g key={m.month}>
                  <rect
                    className={styles.barNok}
                    x={x}
                    y={base - okH - nokH}
                    width={barW}
                    height={nokH}
                  />
                  <rect className={styles.barOk} x={x} y={base - okH} width={barW} height={okH} />
                  <text className={styles.barTop} x={x + barW / 2} y={base - okH - nokH - 4}>
                    {pct(m.ok_rate)}
                  </text>
                  <text className={styles.axis} x={x + barW / 2} y={H - 8}>
                    {monthLabel(m.month, i18n.language)}
                  </text>
                </g>
              );
            })}
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
