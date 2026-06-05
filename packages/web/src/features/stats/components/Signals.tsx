import { useTranslation } from 'react-i18next';
import type { Signal } from '@macronome/shared';
import styles from '../stats.module.css';

// Signals block (spec/logic/stats-adherence.md §7): factual, rule-based flags. The web
// localizes each via stats.signal.<code> with the server's `value`, falling back to the
// contract's English `text`. No motivational copy.
export function Signals({ signals }: { signals: Signal[] }) {
  const { t } = useTranslation();
  if (signals.length === 0) return <p className={styles.signalNone}>{t('stats.signal.none')}</p>;
  return (
    <ul className={styles.signals}>
      {signals.map((s) => (
        <li key={s.code} className={styles.signal}>
          {t(`stats.signal.${s.code}`, { value: s.value, defaultValue: s.text })}
        </li>
      ))}
    </ul>
  );
}
