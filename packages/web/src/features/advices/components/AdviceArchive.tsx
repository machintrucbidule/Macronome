import { useTranslation } from 'react-i18next';
import type { Advice } from '@macronome/shared';
import { AdviceMarkdown } from './AdviceMarkdown';
import styles from '../advices.module.css';

// Archived-advice list (B-202, block D): newest first, each item = date · model + the rendered
// Markdown + a per-item delete (×). The delete calls back to the page's mutation. Empty → a hint.
interface AdviceArchiveProps {
  advices: Advice[];
  onDelete: (id: string) => void;
}

function dateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function AdviceArchive({ advices, onDelete }: AdviceArchiveProps) {
  const { t, i18n } = useTranslation();
  if (advices.length === 0) return <p className={styles.empty}>{t('advices.empty')}</p>;
  return (
    <div className={styles.archive}>
      {advices.map((a) => (
        <article key={a.id} className={styles.item}>
          <header className={styles.itemHead}>
            <span className={styles.itemMeta}>
              {dateTime(a.created_at, i18n.language)} · {a.model}
            </span>
            <button
              type="button"
              className={styles.del}
              title={t('common.remove')}
              aria-label={t('common.remove')}
              onClick={() => onDelete(a.id)}
            >
              ×
            </button>
          </header>
          <AdviceMarkdown>{a.content}</AdviceMarkdown>
        </article>
      ))}
    </div>
  );
}
