import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { previewRemaining } from '../logic/remainingPreview';
import { RemainingCards } from './RemainingCards';
import styles from './modals.module.css';

// Request step of the "Proposition IA" dialog (mockup state 2, B-123): pick which of the day's
// meals to fill (default none, ≥1 to submit — enforced by the dialog footer), free-text
// precisions (≤500), and the day-wide remaining-target cards. Renders only; the selection +
// note live in the parent dialog so the footer can gate "Proposer" and submit.
interface Props {
  day: DayDetail;
  mealIds: string[];
  onToggleMeal: (id: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  disabled: boolean;
}

export function RequestStep({ day, mealIds, onToggleMeal, note, onNoteChange, disabled }: Props) {
  const { t } = useTranslation();
  const rem = previewRemaining(day.target_snapshot, day.totals);

  return (
    <>
      <div className={styles.aiHint}>{t('meals.proposals.intro')}</div>

      <span className={styles.fieldLbl}>{t('meals.proposals.mealsLabel')}</span>
      <div className={styles.mealPick}>
        {day.meals.map((m) => (
          <label key={m.id} className={styles.mealPickRow}>
            <input
              type="checkbox"
              checked={mealIds.includes(m.id)}
              disabled={disabled}
              onChange={() => onToggleMeal(m.id)}
            />
            <span className={styles.mealPickName}>{m.slot_name}</span>
            <span className={styles.mealPickState}>
              {m.entries.length > 0
                ? t('meals.proposals.mealFilled')
                : t('meals.proposals.mealEmpty')}
            </span>
          </label>
        ))}
      </div>

      <label className={styles.aiNoteField}>
        <span>{t('meals.proposals.noteLabel')}</span>
        <textarea
          value={note}
          maxLength={500}
          disabled={disabled}
          placeholder={t('meals.proposals.notePlaceholder')}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </label>
      <div className={styles.charCount}>{`${note.length} / 500`}</div>

      <span className={styles.fieldLbl}>{t('meals.proposals.remainingLabel')}</span>
      <RemainingCards rem={rem} />
    </>
  );
}
