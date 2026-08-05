import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Advice } from '@macronome/shared';
import { lazyNamed } from '../../../lib/lazyNamed';
import { AdviceDeleteConfirm } from './AdviceDeleteConfirm';
import styles from '../advices.module.css';

// B-266: react-markdown + remark-gfm are the app's heaviest third-party leaf and are used here
// only — inside a collapsed card. They load when a card is first expanded, not with the screen.
const AdviceMarkdown = lazyNamed<{ children: string }>(
  () => import('./AdviceMarkdown'),
  'AdviceMarkdown',
);

// Archived-advice list (B-202 block D; B-213 + B-214): newest first, each item = date · model +
// the rendered Markdown, collapsible (house ▸/▾). Defaults (B-214): the just-generated advice is
// expanded, every other card collapsed; on a plain revisit (no fresh generation) all are collapsed.
// Delete (×) is confirmed via the shared modal first (B-213) — never an immediate delete.
interface AdviceArchiveProps {
  advices: Advice[];
  onDelete: (id: string) => void;
  /** The advice just generated this session (if any) — expanded by default; all others collapsed. */
  justGeneratedId?: string | null;
}

function dateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function AdviceArchive({ advices, onDelete, justGeneratedId }: AdviceArchiveProps) {
  const { t, i18n } = useTranslation();
  // Per-card open state. Reset whenever a new advice is generated: only that card opens, the rest
  // collapse. On a fresh mount `justGeneratedId` is null → the map stays empty → all collapsed.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setOpenMap(justGeneratedId ? { [justGeneratedId]: true } : {});
  }, [justGeneratedId]);

  if (advices.length === 0) return <p className={styles.empty}>{t('advices.empty')}</p>;

  const toggle = (id: string): void => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className={styles.archive}>
      {advices.map((a) => {
        const open = openMap[a.id] ?? false;
        return (
          <article key={a.id} className={styles.item}>
            <header className={styles.itemHead}>
              <button
                type="button"
                className={styles.itemToggle}
                aria-expanded={open}
                onClick={() => toggle(a.id)}
              >
                <span className={styles.itemGlyph} aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
                <span className={styles.itemMeta}>
                  {dateTime(a.created_at, i18n.language)} · {a.model}
                </span>
              </button>
              <button
                type="button"
                className={styles.del}
                title={t('common.remove')}
                aria-label={t('common.remove')}
                onClick={() => setPendingDeleteId(a.id)}
              >
                ×
              </button>
            </header>
            {open && (
              <Suspense fallback={null}>
                <AdviceMarkdown>{a.content}</AdviceMarkdown>
              </Suspense>
            )}
          </article>
        );
      })}
      {pendingDeleteId !== null && (
        <AdviceDeleteConfirm
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            onDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }}
        />
      )}
    </div>
  );
}
