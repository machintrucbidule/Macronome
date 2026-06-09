import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayDetail, MealSuggestions } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { ApiError } from '../../../api/client';
import { useMealSuggestions } from '../hooks/useMealSuggestions';
import { RequestStep } from './RequestStep';
import styles from './modals.module.css';

// "Proposition IA" dialog (mockup states 2–3, B-123). Slice 9 wires the request popup + loading:
// pick meals + precisions → POST /ai/meal-suggestions. The 3-proposals display (state 4), refine
// (state 5) and apply (state 6) land in slices 10–12; on success here the result is held in state
// and a neutral placeholder is shown. Persists nothing.
const KNOWN_ERRORS = new Set([
  'ai_not_configured',
  'ai_unauthorized',
  'ai_unreachable',
  'ai_bad_response',
  'ai_rate_limited',
  'ai_unavailable',
]);

interface Props {
  day: DayDetail;
  date: string;
  onClose: () => void;
}

export function AiProposalsDialog({ day, date, onClose }: Props) {
  const { t } = useTranslation();
  const [mealIds, setMealIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [result, setResult] = useState<MealSuggestions | null>(null);
  const suggest = useMealSuggestions();

  const busy = suggest.isPending;
  const canSubmit = mealIds.length >= 1;

  const toggleMeal = (id: string): void =>
    setMealIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = (): void => {
    if (!canSubmit || busy) return;
    setErrorCode(null);
    setErrorDetail(null);
    suggest.mutate(
      { date, meal_ids: mealIds, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: (res) => setResult(res.data),
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : 'ai_bad_response';
          setErrorCode(KNOWN_ERRORS.has(code) ? code : 'ai_bad_response');
          setErrorDetail(err instanceof ApiError ? (err.details?.provider_message ?? null) : null);
        },
      },
    );
  };

  return (
    <Modal title={t('meals.proposals.title')} onClose={onClose}>
      <div className={modalStyles.body}>
        {busy ? (
          <div className={styles.proposalsBusy}>
            <span className={styles.aiSpinner} aria-hidden="true" />
            {t('meals.proposals.busy')}
          </div>
        ) : result ? (
          <div className={styles.aiHint}>
            {t('meals.proposals.received', { count: result.proposals.length })}
          </div>
        ) : (
          <RequestStep
            day={day}
            mealIds={mealIds}
            onToggleMeal={toggleMeal}
            note={note}
            onNoteChange={setNote}
            disabled={busy}
          />
        )}
        {errorCode && !busy && (
          <Banner tone="warning">
            {t(`meals.proposals.errors.${errorCode}`)}
            {errorDetail && <span className={styles.aiErrDetail}>{errorDetail}</span>}
          </Banner>
        )}
      </div>

      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={busy || !canSubmit}>
              {busy && <span className={styles.aiSpinner} aria-hidden="true" />}
              {busy ? t('meals.proposals.proposing') : t('meals.proposals.propose')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
