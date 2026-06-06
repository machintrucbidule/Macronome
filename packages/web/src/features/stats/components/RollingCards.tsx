import { useTranslation } from 'react-i18next';
import type { RollingWindow, VsTarget } from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { pct, r0 } from '../format';
import styles from '../stats.module.css';

// Rolling-average strip (spec/logic/stats-adherence.md §2): four cards — avg kcal/day over
// 7/14/30/365 days, each vs the calorie band + the window OK rate. Always as of the latest
// logged day. Figures are server-computed; this renders them.

const vsClass: Record<VsTarget, string | undefined> = {
  in: styles.vIn,
  above: styles.vAbove,
  below: styles.vBelow,
};

function VsTargetNote({ window }: { window: RollingWindow }) {
  const { t } = useTranslation();
  return (
    <span className={styles.rollNote}>
      {window.vs_target && (
        <span className={vsClass[window.vs_target]}>{t(`stats.vsTarget.${window.vs_target}`)}</span>
      )}
      <span className={styles.okRate}>
        {t('stats.rolling.okRate', { rate: pct(window.ok_rate) })}
      </span>
    </span>
  );
}

export function RollingCards({ windows }: { windows: RollingWindow[] }) {
  const { t } = useTranslation();
  return (
    <div className={styles.rolling}>
      {windows.map((w) => (
        <MetricCard
          key={w.window}
          size="stat"
          label={t('stats.rolling.window', { n: w.window })}
          value={r0(w.avg_kcal)}
          unit="kcal"
          note={<VsTargetNote window={w} />}
        />
      ))}
    </div>
  );
}
