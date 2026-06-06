import { useTranslation } from 'react-i18next';
import type { Signal } from '@macronome/shared';
import styles from '../stats.module.css';

// Signals block (spec/logic/stats-adherence.md §7; design/components/charts.md §Signals):
// a responsive grid of `.sig` cards, each a status dot + factual, rule-based text. The web
// localizes each via stats.signal.<code> with the server's `value`, falling back to the
// contract's English `text`. No motivational copy, no nutrition computation here.

type DotStatus = 'ok' | 'warn' | 'info';

// Presentational map: which status dot a given server signal code shows. View-only — the
// signal itself (and its `value`) is server-computed; this only picks a colour.
const DOT_BY_CODE: Record<string, DotStatus> = {
  avg30_above_target: 'warn',
  avg30_below_target: 'info',
  nok_run: 'warn',
  ok_rate_14: 'info',
};

const DOT_CLASS: Record<DotStatus, string | undefined> = {
  ok: styles.dotOk,
  warn: styles.dotWarn,
  info: styles.dotInfo,
};

export function Signals({ signals }: { signals: Signal[] }) {
  const { t } = useTranslation();
  if (signals.length === 0) return <p className={styles.signalNone}>{t('stats.signal.none')}</p>;
  return (
    <ul className={styles.signals}>
      {signals.map((s) => (
        <li key={s.code} className={styles.sig}>
          <span
            className={[styles.dot, DOT_CLASS[DOT_BY_CODE[s.code] ?? 'info']]
              .filter(Boolean)
              .join(' ')}
          />
          <span className={styles.sigText}>
            {t(`stats.signal.${s.code}`, { value: s.value, defaultValue: s.text })}
          </span>
        </li>
      ))}
    </ul>
  );
}
