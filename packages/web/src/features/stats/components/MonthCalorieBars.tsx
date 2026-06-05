import { useTranslation } from 'react-i18next';
import type { MonthlyStat, TargetZone } from '@macronome/shared';
import { linear, niceDomain } from '../../../components/Chart/scale';
import { monthLabel, r0 } from '../format';
import styles from '../stats.module.css';

// Average calories per month, split OK/NOK (spec/logic/stats-adherence.md §5): two grouped
// bars per month over the shaded target band [cal_min, cal_max]. Inline SVG, semantic
// tokens only. Averages are server-computed (full precision); shown rounded to integer kcal.

const W = 720;
const H = 220;
const PAD = { l: 36, r: 8, t: 12, b: 22 };

export function MonthCalorieBars({
  monthly,
  zone,
}: {
  monthly: MonthlyStat[];
  zone: TargetZone | null;
}) {
  const { i18n } = useTranslation();
  const base = H - PAD.b;
  const values = monthly.flatMap((m) =>
    [m.avg_kcal_ok, m.avg_kcal_nok].filter((v): v is number => v !== null),
  );
  if (zone) values.push(zone.cal_min, zone.cal_max);
  const [lo, hi] = niceDomain(values.length ? values : [0, 1]);
  const y = linear(lo, hi, base, PAD.t);
  const slot = (W - PAD.l - PAD.r) / Math.max(monthly.length, 1);
  const barW = Math.min(slot * 0.28, 16);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={styles.bars}>
      {zone && (
        <rect
          className={styles.zone}
          x={PAD.l}
          y={y(zone.cal_max)}
          width={W - PAD.l - PAD.r}
          height={Math.max(0, y(zone.cal_min) - y(zone.cal_max))}
        />
      )}
      {monthly.map((m, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        return (
          <g key={m.month}>
            {m.avg_kcal_ok !== null && (
              <rect
                className={styles.barOk}
                x={cx - barW - 1}
                y={y(m.avg_kcal_ok)}
                width={barW}
                height={base - y(m.avg_kcal_ok)}
              >
                <title>{`${monthLabel(m.month, i18n.language)} · OK ${r0(m.avg_kcal_ok)} kcal`}</title>
              </rect>
            )}
            {m.avg_kcal_nok !== null && (
              <rect
                className={styles.barNok}
                x={cx + 1}
                y={y(m.avg_kcal_nok)}
                width={barW}
                height={base - y(m.avg_kcal_nok)}
              >
                <title>{`${monthLabel(m.month, i18n.language)} · NOK ${r0(m.avg_kcal_nok)} kcal`}</title>
              </rect>
            )}
            <text className={styles.axis} x={cx} y={H - 8}>
              {monthLabel(m.month, i18n.language)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
