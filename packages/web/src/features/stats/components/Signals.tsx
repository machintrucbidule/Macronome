import { useTranslation } from 'react-i18next';
import type { Signal } from '@macronome/shared';
import styles from '../stats.module.css';

// Signals block (spec/logic/stats-adherence.md §7; design/components/charts.md §Signals):
// a responsive grid of `.sig` cards, each a status dot + factual, rule-based text. The web
// localizes each via stats.signal.<code> with the server's `value`, falling back to the
// contract's English `text`. The dot colour follows the server-decided `status` (rule 2:
// the web never derives a verdict). No motivational copy, no nutrition computation here.

const DOT_CLASS: Record<Signal['status'], string | undefined> = {
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
          <span className={[styles.dot, DOT_CLASS[s.status]].filter(Boolean).join(' ')} />
          <span className={styles.sigText}>
            {t(`stats.signal.${s.code}`, { value: s.value, defaultValue: s.text })}
          </span>
        </li>
      ))}
    </ul>
  );
}
