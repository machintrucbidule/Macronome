import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { JournalRow as Row, PatchDayRequest } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import {
  FilterSheet,
  ListToolbar,
  OverflowMenu,
  SortSheet,
  type FilterOption,
  type SortOption,
} from '../../../components/ListChrome';
import { JournalCards } from './JournalCards';
import { JournalDaySheet } from './JournalDaySheet';
import { currentYear } from '../format';
import type { JournalSortField } from '../sort';
import type { JournalSort } from '../useJournalSort';
import journalStyles from '../journal.module.css';

// Journal mobile view (mobile-responsive S5): the phone presentation rendered when
// useIsMobile() is true. The app bar already shows the "Journal" title (S3), so the screen
// adds a sticky toolbar (year selector + Trier + Filtrer-by-month + "⋯" export) via the shared
// list chrome, the card list, and the tap-to-edit day sheet. The day-state legend + day count
// are omitted on mobile (owner decision) — the card calorie/verdict/activity colours carry the
// meaning. It consumes the same data + sort state + onPatch as the desktop table; desktop is
// untouched (this component never mounts ≥561px).
interface JournalMobileProps {
  year: number;
  minYear: number | null;
  maxYear: number | null;
  loading: boolean;
  rows: Row[];
  sort: JournalSort;
  onYear: (year: number) => void;
  onExport: () => void;
  onPatch: (date: string, body: PatchDayRequest) => void;
}

// Capitalised long month name for a "MM" key, in the active locale (presentation only).
function monthLabel(monthKey: string, locale: string): string {
  const name = new Date(2000, Number(monthKey) - 1, 1).toLocaleDateString(locale, {
    month: 'long',
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function JournalMobile(props: JournalMobileProps) {
  const { t, i18n } = useTranslation();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const now = currentYear();
  const lower = Math.min(now, props.minYear ?? now);
  const upper = Math.max(now, props.maxYear ?? now);

  const sortOptions: SortOption<JournalSortField>[] = [
    { key: 'date', label: t('journal.col.day') },
    { key: 'kcal', label: t('journal.col.calories') },
    { key: 'verdict', label: t('journal.col.verdict') },
    { key: 'activity', label: t('journal.col.activity') },
  ];

  // Months that actually have data this year (presentation-only client filter, like the sort).
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of props.rows) set.add(r.date.slice(5, 7));
    return [...set].sort();
  }, [props.rows]);
  // Clamp a stale selection (e.g. after a year change) to "all" so the filter never breaks.
  const activeMonth = month && months.includes(month) ? month : '';
  const filterOptions: FilterOption[] = [
    { key: '', label: t('journal.allMonths') },
    ...months.map((m) => ({ key: m, label: monthLabel(m, i18n.language) })),
  ];
  const visibleRows = activeMonth
    ? props.rows.filter((r) => r.date.slice(5, 7) === activeMonth)
    : props.rows;

  // Resolve the open row from the live rows so edits (after refetch) stay in sync.
  const openRow = openDate != null ? (props.rows.find((r) => r.date === openDate) ?? null) : null;

  // Loading → empty → cards, mirroring the desktop JournalContent switch (no nested ternary).
  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.rows.length === 0) return <EmptyState>{t('journal.empty')}</EmptyState>;
    return <JournalCards rows={visibleRows} onOpen={(row) => setOpenDate(row.date)} />;
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
        <FilterSheet
          options={filterOptions}
          value={activeMonth}
          onSelect={(k) => setMonth(k === '' ? null : k)}
        />
        <OverflowMenu actions={[{ label: t('journal.exportCsv'), onClick: props.onExport }]} />
      </ListToolbar>

      {body}

      {openRow && (
        <JournalDaySheet row={openRow} onClose={() => setOpenDate(null)} onPatch={props.onPatch} />
      )}
    </>
  );
}
