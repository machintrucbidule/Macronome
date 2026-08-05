import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  type ActivityLevel,
  type JournalRow as Row,
  type PatchDayRequest,
  type Verdict,
} from '@macronome/shared';
import { VerdictBadge } from '../../../components/VerdictBadge/VerdictBadge';
import { ActivitySelect } from '../../../components/ActivitySelect/ActivitySelect';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { CommentCell } from './CommentCell';
import { CaloriesCell } from './CaloriesCell';
import { JournalGap } from './JournalGap';
import { formatDow, formatJournalDate, r0 } from '../format';
import styles from '../journal.module.css';

// One Journal day row (history.md + day-model): clickable Jour/Macros open that day's Repas;
// the Calories cell is inline-editable on a no-detail day (creates/updates a summary day);
// the verdict pill, activity select and comment field edit the day via PATCH (which upserts).
// Macros show only on detailed days; summary/empty days show an em-dash. An empty (red) day is
// a past/present date with no calorie value (day-model §8). Each row carries a left colour band
// keyed to its state (JR-1 / B-077): green Complet, yellow Partiel, red Rien (none = no band).
const DASH = '—';

const STATE_ROW_CLASS: Record<Row['state'], string | undefined> = {
  green: styles.detailedRow,
  yellow: styles.summaryRow,
  red: styles.emptyRow,
  none: undefined,
};

/** The L·G·P cell: values on a detailed day, an em-dash otherwise. Also a click into the day. */
function MacrosCell({ macros, onOpen }: { macros: Row['macros']; onOpen: () => void }) {
  return (
    <td className={`${tableStyles.num} ${tableStyles.clickable}`} onClick={onOpen}>
      {macros ? (
        <span className={styles.macros}>
          <span className={`${styles.mVal} ${styles.mFat}`}>{r0(macros.L)}</span>
          <span className={`${styles.mVal} ${styles.mCarb}`}>{r0(macros.G)}</span>
          <span className={`${styles.mVal} ${styles.mProt}`}>{r0(macros.P)}</span>
        </span>
      ) : (
        DASH
      )}
    </td>
  );
}

interface JournalRowProps {
  row: Row;
  onPatch: (date: string, body: PatchDayRequest) => void;
  /** Index in the sorted year — how the virtualiser (B-267) attributes a measured height. */
  index?: number;
  /** Virtualiser ref: measures this row's real height, replacing the estimate. */
  measure?: (el: Element | null) => void;
}

export function JournalRow({ row, onPatch, index, measure }: JournalRowProps) {
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
    <tr
      data-date={row.date}
      data-index={index}
      ref={measure}
      className={STATE_ROW_CLASS[row.state]}
    >
      <td className={tableStyles.clickable} onClick={openDay}>
        {formatJournalDate(row.date, i18n.language)}{' '}
        <span className={styles.dow}>{formatDow(row.date, i18n.language)}</span>
      </td>
      <CaloriesCell
        kcal={row.kcal}
        editable={row.editable_kcal}
        placeholder={t('journal.kcalPlaceholder')}
        onOpen={openDay}
        onSave={(k) => onPatch(row.date, { summary_kcal: k })}
      />
      <MacrosCell macros={row.macros} onOpen={openDay} />
      <td>
        <div className={styles.verdictCell}>
          {/* Fixed-width slot so the écarts line up just to the right of the badge regardless of
              its auto/forcé sub-label width. */}
          <span className={styles.badgeSlot}>
            <VerdictBadge
              effective={row.effective_verdict}
              auto={row.verdict_auto}
              override={row.verdict_override}
              labels={verdictLabels}
              onSet={(v) => onPatch(row.date, { verdict_override: v })}
              belowBurn={row.burn_gap === null ? null : row.burn_gap <= 0}
            />
          </span>
          {/* Écart vs the upper target (cal_max), server-provided (B-138). */}
          <JournalGap value={row.kcal_gap} kind="target" />
        </div>
      </td>
      <td>
        <div className={styles.activityCell}>
          {/* Fixed-width slot so the burn écarts line up just to the right of the selector. */}
          <span className={styles.activitySlot}>
            <ActivitySelect
              value={row.activity_level as ActivityLevel}
              onChange={(lvl) => onPatch(row.date, { activity_level: lvl })}
              ariaLabel={t('journal.col.activity')}
            />
          </span>
          {/* Second écart vs the day's estimated expenditure (kcal − burn), server-provided (B-163). */}
          <JournalGap value={row.burn_gap} kind="burn" />
        </div>
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
