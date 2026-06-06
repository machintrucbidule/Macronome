import { useTranslation } from 'react-i18next';
import type { MonthlyStat } from '@macronome/shared';
import { monthLabel, pct } from '../format';
import styles from '../stats.module.css';

// Monthly OK/NOK pivot (spec/logic/stats-adherence.md §4): one stacked bar per month —
// OK (green) over NOK (red), height ∝ logged days — with the OK% label. Inline SVG,
// semantic tokens only. Counts/rate are server-computed; this only draws them.

const W = 720;
const H = 200;
const PAD = { l: 24, r: 8, t: 18, b: 22 };

export function MonthlyBars({ monthly }: { monthly: MonthlyStat[] }) {
  const { t, i18n } = useTranslation();
  const base = H - PAD.b;
  const plotH = base - PAD.t;
  const maxTotal = Math.max(1, ...monthly.map((m) => m.ok_count + m.nok_count));
  const slot = (W - PAD.l - PAD.r) / Math.max(monthly.length, 1);
  const barW = Math.min(slot * 0.6, 34);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={styles.bars}>
      {monthly.map((m, i) => {
        const x = PAD.l + slot * i + (slot - barW) / 2;
        const okH = (m.ok_count / maxTotal) * plotH;
        const nokH = (m.nok_count / maxTotal) * plotH;
        const label = monthLabel(m.month, i18n.language);
        const tip = `${label} · ${t('stats.monthly.tooltip', { ok: m.ok_count, nok: m.nok_count })}`;
        return (
          <g key={m.month}>
            <rect className={styles.barNok} x={x} y={base - okH - nokH} width={barW} height={nokH}>
              <title>{tip}</title>
            </rect>
            <rect className={styles.barOk} x={x} y={base - okH} width={barW} height={okH}>
              <title>{tip}</title>
            </rect>
            <text className={styles.barTop} x={x + barW / 2} y={base - okH - nokH - 4}>
              {pct(m.ok_rate)}
            </text>
            <text className={styles.axis} x={x + barW / 2} y={H - 8}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
