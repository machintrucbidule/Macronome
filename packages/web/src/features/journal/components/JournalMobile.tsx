import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { JournalRow as Row, PatchDayRequest } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import {
  ListToolbar,
  OverflowMenu,
  SortSheet,
  type SortOption,
} from '../../../components/ListChrome';
import { JournalCards } from './JournalCards';
import { JournalDaySheet } from './JournalDaySheet';
import { currentYear } from '../format';
import type { JournalSortField } from '../sort';
import type { JournalSort } from '../useJournalSort';
import journalStyles from '../journal.module.css';
import styles from '../journal-mobile.module.css';

// Journal mobile view (mobile-responsive S5): the phone presentation rendered when
// useIsMobile() is true. The app bar already shows the "Journal" title (S3), so the screen
// adds a sticky toolbar (year selector + Trier + "⋯" export) via the shared list chrome, the
// day count, the card list, and the tap-to-edit day sheet. The day-state legend is omitted on
// mobile (owner decision) — the card calories/verdict/activity colours carry the meaning. It
// consumes the same data + sort state + onPatch as the desktop table; desktop is untouched
// (this component never mounts ≥561px).
interface JournalMobileProps {
  year: number;
  dayCount: number;
  minYear: number | null;
  maxYear: number | null;
  loading: boolean;
  rows: Row[];
  sort: JournalSort;
  onYear: (year: number) => void;
  onExport: () => void;
  onPatch: (date: string, body: PatchDayRequest) => void;
}

export function JournalMobile(props: JournalMobileProps) {
  const { t } = useTranslation();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const now = currentYear();
  const lower = Math.min(now, props.minYear ?? now);
  const upper = Math.max(now, props.maxYear ?? now);

  const sortOptions: SortOption<JournalSortField>[] = [
    { key: 'date', label: t('journal.col.day') },
    { key: 'kcal', label: t('journal.col.calories') },
    { key: 'verdict', label: t('journal.col.verdict') },
    { key: 'activity', label: t('journal.col.activity') },
  ];

  // Resolve the open row from the live rows so edits (after refetch) stay in sync.
  const openRow = openDate != null ? (props.rows.find((r) => r.date === openDate) ?? null) : null;

  // Loading → empty → cards, mirroring the desktop JournalContent switch (no nested ternary).
  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.rows.length === 0) return <EmptyState>{t('journal.empty')}</EmptyState>;
    return <JournalCards rows={props.rows} onOpen={(row) => setOpenDate(row.date)} />;
  })();

  return (
    <>
      <ListToolbar
        leading={
          <div className={journalStyles.yearNav}>
            <button
              type="button"
              aria-label={t('journal.prevYear')}
              disabled={props.year <= lower}
              onClick={() => props.onYear(props.year - 1)}
            >
              ◀
            </button>
            <span className={journalStyles.year}>{props.year}</span>
            <button
              type="button"
              aria-label={t('journal.nextYear')}
              disabled={props.year >= upper}
              onClick={() => props.onYear(props.year + 1)}
            >
              ▶
            </button>
          </div>
        }
      >
        <SortSheet
          options={sortOptions}
          sort={props.sort.sort}
          dir={props.sort.dir}
          onSort={props.sort.onSort}
        />
        <OverflowMenu actions={[{ label: t('journal.exportCsv'), onClick: props.onExport }]} />
      </ListToolbar>

      <div className={styles.subhead}>
        <span className={styles.count}>{t('journal.dayCount', { count: props.dayCount })}</span>
      </div>

      {body}

      {openRow && (
        <JournalDaySheet row={openRow} onClose={() => setOpenDate(null)} onPatch={props.onPatch} />
      )}
    </>
  );
}
