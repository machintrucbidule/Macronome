import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  type ActivityLevel,
  type JournalRow as Row,
  type PatchDayRequest,
  type Verdict,
} from '@macronome/shared';
import { Modal } from '../../../components/Modal/Modal';
import { VerdictBadge } from '../../../components/VerdictBadge/VerdictBadge';
import { ActivitySelect } from '../../../components/ActivitySelect/ActivitySelect';
import { CommentCell } from './CommentCell';
import { formatDow, formatJournalDate, r0 } from '../format';
import styles from '../journal-mobile.module.css';

// Journal day-editor bottom sheet (mobile-responsive S5, spec §4.2). Tapping a card opens
// this; it edits the same fields the desktop row offers inline — kcal (summary/empty days
// only), verdict override, activity, comment — via the same PATCH /days/:date round-trip
// (onPatch upserts). It adds an "Ouvrir la journée" action navigating to the full Repas day
// (the desktop date/macros-cell affordance; owner decision 2026-06-10). Renders, never computes.
interface JournalDaySheetProps {
  row: Row;
  onClose: () => void;
  onPatch: (date: string, body: PatchDayRequest) => void;
}

export function JournalDaySheet({ row, onClose, onPatch }: JournalDaySheetProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const verdictLabels = {
    forceOk: t('journal.verdict.forceOk'),
    forceNok: t('journal.verdict.forceNok'),
    autoCalc: (a: Verdict | null) =>
      a ? t('journal.verdict.autoCalcWith', { v: a }) : t('journal.verdict.autoCalc'),
    auto: t('journal.verdict.auto'),
    forced: t('journal.verdict.forced'),
  };

  const title = (
    <span>
      {formatJournalDate(row.date, i18n.language)}{' '}
      <span className={styles.dow}>{formatDow(row.date, i18n.language)}</span>
    </span>
  );

  return (
    <Modal title={title} onClose={onClose}>
      <div className={styles.sheet}>
        {row.editable_kcal && (
          <KcalField
            kcal={row.kcal}
            placeholder={t('journal.kcalPlaceholder')}
            label={t('journal.col.calories')}
            onSave={(k) => onPatch(row.date, { summary_kcal: k })}
          />
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('journal.col.verdict')}</span>
          <VerdictBadge
            effective={row.effective_verdict}
            auto={row.verdict_auto}
            override={row.verdict_override}
            labels={verdictLabels}
            onSet={(v) => onPatch(row.date, { verdict_override: v })}
            belowBurn={row.burn_gap === null ? null : row.burn_gap <= 0}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('journal.col.activity')}</span>
          <ActivitySelect
            value={row.activity_level as ActivityLevel}
            onChange={(lvl) => onPatch(row.date, { activity_level: lvl })}
            ariaLabel={t('journal.col.activity')}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('journal.col.comment')}</span>
          <CommentCell
            value={row.comment}
            placeholder={t('journal.commentPlaceholder')}
            onSave={(c) => onPatch(row.date, { comment: c })}
          />
        </div>

        <button
          type="button"
          className={styles.openDay}
          onClick={() => void navigate(`/day/${row.date}`)}
        >
          {t('journal.openDay')}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </Modal>
  );
}

// Inline kcal field for summary/empty days (same commit rule as the desktop CaloriesCell:
// PATCH summary_kcal only on a finite, positive, changed value). CaloriesCell itself renders
// a <td>, so the sheet uses its own full-width input rather than reusing that cell.
function KcalField({
  kcal,
  placeholder,
  label,
  onSave,
}: {
  kcal: number;
  placeholder: string;
  label: string;
  onSave: (kcal: number) => void;
}) {
  // Seeded at display precision, like the desktop cell (B-250).
  const [draft, setDraft] = useState(kcal > 0 ? String(r0(kcal)) : '');
  const commit = (): void => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n !== kcal) onSave(n);
  };
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.sheetInput}
        value={draft}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}
