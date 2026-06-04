import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ACTIVITY_LABEL_KEYS,
  ACTIVITY_LEVELS,
  type ActivityLevel,
  type JournalRow as Row,
  type PatchDayRequest,
  type Verdict,
} from '@macronome/shared';
import { VerdictBadge } from '../../../components/VerdictBadge/VerdictBadge';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { CommentCell } from './CommentCell';
import { formatDow, formatJournalDate, r0 } from '../format';
import styles from '../journal.module.css';

// One Journal day row (history.md): clickable Jour/Calories/Macros open that day's Repas;
// the verdict pill, activity select and comment field edit the day via PATCH. Macros show
// only on detailed days; summary/empty days show an em-dash.
const DASH = '—';

interface JournalRowProps {
  row: Row;
  onPatch: (date: string, body: PatchDayRequest) => void;
}

export function JournalRow({ row, onPatch }: JournalRowProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const openDay = (): void => {
    void navigate(`/day/${row.date}`);
  };

  const verdictLabels = {
    forceOk: t('journal.verdict.forceOk'),
    forceNok: t('journal.verdict.forceNok'),
    autoCalc: (a: Verdict | null) =>
      a ? t('journal.verdict.autoCalcWith', { v: a }) : t('journal.verdict.autoCalc'),
    auto: t('journal.verdict.auto'),
    forced: t('journal.verdict.forced'),
  };

  return (
    <tr data-date={row.date}>
      <td className={tableStyles.clickable} onClick={openDay}>
        {formatJournalDate(row.date, i18n.language)}{' '}
        <span className={styles.dow}>{formatDow(row.date, i18n.language)}</span>
      </td>
      <td className={`${tableStyles.num} ${tableStyles.clickable}`} onClick={openDay}>
        {r0(row.kcal)}
      </td>
      <td className={`${tableStyles.num} ${tableStyles.clickable}`} onClick={openDay}>
        {row.macros ? (
          <>
            <span className={styles.mFat}>{r0(row.macros.L)}</span>{' '}
            <span className={styles.mCarb}>{r0(row.macros.G)}</span>{' '}
            <span className={styles.mProt}>{r0(row.macros.P)}</span>
          </>
        ) : (
          DASH
        )}
      </td>
      <td>
        <VerdictBadge
          effective={row.effective_verdict}
          auto={row.verdict_auto}
          override={row.verdict_override}
          labels={verdictLabels}
          onSet={(v) => onPatch(row.date, { verdict_override: v })}
        />
      </td>
      <td>
        <select
          className={styles.activity}
          value={row.activity_level ?? ''}
          onChange={(e) =>
            onPatch(row.date, {
              activity_level: (e.target.value || null) as ActivityLevel | null,
            })
          }
        >
          <option value="">{t('journal.activityNone')}</option>
          {ACTIVITY_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {t(ACTIVITY_LABEL_KEYS[lvl].label)}
            </option>
          ))}
        </select>
      </td>
      <td className={styles.commentCell}>
        <CommentCell
          value={row.comment}
          placeholder={t('journal.commentPlaceholder')}
          onSave={(c) => onPatch(row.date, { comment: c })}
        />
      </td>
    </tr>
  );
}
