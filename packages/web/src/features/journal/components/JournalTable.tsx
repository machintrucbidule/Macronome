import { useTranslation } from 'react-i18next';
import type { JournalRow as Row, PatchDayRequest } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { useGrowingRows } from '../../../lib/useGrowingRows';
import { JournalRow } from './JournalRow';
import type { JournalSortField } from '../sort';
import styles from '../journal.module.css';

// The Journal table (history.md): one row per day. Jour · Calories · Verdict · Activité are
// sortable client-side (the whole year is loaded); Macros (L·G·P) and Commentaire are not.
// The table is a read view with inline edits.
//
// B-267/B-275: the whole year is fetched and sorted, but rows are rendered progressively — each
// carries four interactive controls and 366 of them cost about a second to mount. Rendering only
// ever **grows** (B-275): a row that has been drawn is never taken back, so scrolling up is
// instant. Sorting and the CSV export are unaffected (they work off the full array / the server);
// browser Ctrl+F reaches every row rendered so far.
interface JournalTableProps {
  rows: Row[];
  sort: JournalSortField;
  dir: 'asc' | 'desc';
  onSort: (field: JournalSortField) => void;
  onPatch: (date: string, body: PatchDayRequest) => void;
}

// Sortable column → i18n label key (field names differ from the column labels).
const SORT_LABEL: Record<JournalSortField, string> = {
  date: 'journal.col.day',
  kcal: 'journal.col.calories',
  verdict: 'journal.col.verdict',
  activity: 'journal.col.activity',
};

export function JournalTable({ rows, sort, dir, onSort, onPatch }: JournalTableProps) {
  const { t } = useTranslation();
  const win = useGrowingRows(rows.length);
  const th = (field: JournalSortField, align: 'left' | 'right' | 'center') => (
    <SortableTh
      field={field}
      active={sort === field}
      dir={dir}
      align={align}
      onSort={(f) => onSort(f as JournalSortField)}
    >
      {t(SORT_LABEL[field])}
    </SortableTh>
  );
  return (
    <div className={tableStyles.wrap}>
      <table className={`${tableStyles.table} ${styles.journalTable}`}>
        <thead>
          <tr>
            {th('date', 'left')}
            {th('kcal', 'right')}
            <th className={tableStyles.r}>{t('journal.col.macros')}</th>
            {th('verdict', 'left')}
            {th('activity', 'left')}
            <th>{t('journal.col.comment')}</th>
          </tr>
        </thead>
        {/* One trailing spacer carries the height of the days not drawn yet, so the scrollbar
            spans the whole year from the start. There is no leading spacer: rendering starts at
            the first row and only ever grows. */}
        <tbody ref={win.listRef as React.RefObject<HTMLTableSectionElement>}>
          {rows.slice(0, win.rendered).map((row) => (
            <JournalRow key={row.date} row={row} onPatch={onPatch} />
          ))}
        </tbody>
        {win.padBottom > 0 && (
          <tbody aria-hidden="true">
            <tr>
              <td colSpan={6} style={{ height: win.padBottom, padding: 0, border: 'none' }} />
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}
