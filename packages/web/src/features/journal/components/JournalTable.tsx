import { useTranslation } from 'react-i18next';
import type { JournalRow as Row, PatchDayRequest } from '@macronome/shared';
import { SortableTh, tableStyles } from '../../../components/DataTable/SortableTh';
import { useWindowRows } from '../../../lib/useWindowRows';
import { JournalRow } from './JournalRow';
import type { JournalSortField } from '../sort';
import styles from '../journal.module.css';

// The Journal table (history.md): one row per day. Jour · Calories · Verdict · Activité are
// sortable client-side (the whole year is loaded); Macros (L·G·P) and Commentaire are not.
// The table is a read view with inline edits.
//
// B-267: the whole year is still fetched and sorted, but only the rows near the viewport are
// mounted — each row carries four interactive controls, and 366 of them cost about a second.
// Sorting and the CSV export are unaffected (they work off the full array / the server); browser
// Ctrl+F no longer reaches a day that is off screen, which the owner accepted.

// A Journal row is denser than the shared table row (B-065 trims the cell padding) but taller than
// the text it holds, because the verdict badge and activity select are 30px controls. Only a
// starting estimate: real heights are measured as rows come into view.
const ROW_HEIGHT = 38;
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
  const win = useWindowRows(rows.length, ROW_HEIGHT);
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
        {/* Spacer rows carry the height of everything not rendered, so the scrollbar spans the
            whole year and the visible rows sit at their real position. */}
        <tbody ref={win.listRef as React.RefObject<HTMLTableSectionElement>}>
          {win.padTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={6} style={{ height: win.padTop, padding: 0, border: 'none' }} />
            </tr>
          )}
          {win.indexes.map((i) => {
            const row = rows[i];
            return row ? (
              <JournalRow
                key={row.date}
                row={row}
                onPatch={onPatch}
                index={i}
                measure={win.measure}
              />
            ) : null;
          })}
          {win.padBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={6} style={{ height: win.padBottom, padding: 0, border: 'none' }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
