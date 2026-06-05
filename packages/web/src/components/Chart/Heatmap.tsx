import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { HeatmapCell } from '@macronome/shared';
import { monthLabel } from '../../features/stats/format';
import styles from './Heatmap.module.css';

// Calendar heatmap (design/components/charts.md; spec/logic/stats-adherence.md §3): one
// square per calendar date of the year laid out GitHub-style (weeks → columns, weekdays →
// rows, Monday first). Green OK / red NOK / grey not-logged. Inline SVG, semantic tokens
// only (rule 6). Status is server-computed; this only places + colours the cells.

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const TOP = 14; // room for month labels

/** Monday-first weekday index (0 = Mon … 6 = Sun) for a YYYY-MM-DD date. */
function mondayIndex(date: string): number {
  const p = date.split('-');
  return (new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay() + 6) % 7;
}

interface Placed {
  cell: HeatmapCell;
  col: number;
  row: number;
}

function layout(cells: HeatmapCell[]): { placed: Placed[]; cols: number; firstDow: number } {
  if (cells.length === 0) return { placed: [], cols: 0, firstDow: 0 };
  const firstDow = mondayIndex(cells[0]!.date);
  const placed = cells.map((cell, i) => ({
    cell,
    col: Math.floor((i + firstDow) / 7),
    row: (i + firstDow) % 7,
  }));
  return { placed, cols: placed[placed.length - 1]!.col + 1, firstDow };
}

/** First column index of each month → its short label (drawn along the top axis). */
function monthTicks(placed: Placed[], locale: string): { col: number; label: string }[] {
  const seen = new Set<number>();
  const ticks: { col: number; label: string }[] = [];
  for (const p of placed) {
    const month = Number(p.cell.date.slice(5, 7));
    if (!seen.has(month)) {
      seen.add(month);
      ticks.push({ col: p.col, label: monthLabel(month, locale) });
    }
  }
  return ticks;
}

export function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const { t, i18n } = useTranslation();
  const { placed, cols } = useMemo(() => layout(cells), [cells]);
  const ticks = useMemo(() => monthTicks(placed, i18n.language), [placed, i18n.language]);
  const width = Math.max(cols, 1) * STEP;
  const height = TOP + 7 * STEP;
  const cls = { OK: styles.ok, NOK: styles.nok, none: styles.none } as const;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMin meet"
      className={styles.svg}
      role="img"
      aria-label={t('stats.heatmap.label')}
    >
      {ticks.map((tk) => (
        <text key={tk.label} x={tk.col * STEP} y={10} className={styles.month}>
          {tk.label}
        </text>
      ))}
      {placed.map((p) => (
        <rect
          key={p.cell.date}
          x={p.col * STEP}
          y={TOP + p.row * STEP}
          width={CELL}
          height={CELL}
          rx={2}
          className={cls[p.cell.status]}
        >
          <title>{`${p.cell.date} · ${t(`stats.status.${p.cell.status}`)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
