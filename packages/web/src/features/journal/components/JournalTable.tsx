import { useTranslation } from 'react-i18next';
import type { JournalRow as Row, PatchDayRequest } from '@macronome/shared';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { JournalRow } from './JournalRow';

// The Journal table (history.md): one row per day, newest first (server order). Columns:
// Jour · Calories · Macros (L·G·P) · Verdict · Activité · Commentaire. The table is a read
// view with inline edits — no client-side sorting (the API already returns newest-first).
interface JournalTableProps {
  rows: Row[];
  onPatch: (date: string, body: PatchDayRequest) => void;
}

export function JournalTable({ rows, onPatch }: JournalTableProps) {
  const { t } = useTranslation();
  return (
    <div className={tableStyles.wrap}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>{t('journal.col.day')}</th>
            <th className={tableStyles.r}>{t('journal.col.calories')}</th>
            <th className={tableStyles.r}>{t('journal.col.macros')}</th>
            <th>{t('journal.col.verdict')}</th>
            <th>{t('journal.col.activity')}</th>
            <th>{t('journal.col.comment')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <JournalRow key={row.date} row={row} onPatch={onPatch} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
