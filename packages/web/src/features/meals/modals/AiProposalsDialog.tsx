import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayDetail, MealSuggestions } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { ApiError } from '../../../api/client';
import { useMealSuggestions } from '../hooks/useMealSuggestions';
import { RequestStep } from './RequestStep';
import { ProposalsList } from './ProposalsList';
import styles from './modals.module.css';

// "Proposition IA" dialog (mockup states 2–4, B-123). Slices 9–10: pick meals + precisions → POST
// /ai/meal-suggestions (states 2–3), then render the certified proposals (state 4) read-only. The
// per-card "Raffiner" (refine, state 5 / Slice 11) and "Choisir" (apply, state 6 / Slice 12)
// actions, plus "Autres idées" (regenerate), are deferred to their own slices. Persists nothing.
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
  const showResult = !!result && !busy;

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
    <Modal title={t('meals.proposals.title')} size={showResult ? 'wide' : 'md'} onClose={onClose}>
      <div className={modalStyles.body}>
        {busy ? (
          <div className={styles.proposalsBusy}>
            <span className={styles.aiSpinner} aria-hidden="true" />
            {t('meals.proposals.busy')}
          </div>
        ) : result ? (
          <ProposalsList proposals={result.proposals} day={day} />
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

      <DialogActions
        showResult={showResult}
        busy={busy}
        canSubmit={canSubmit}
        onEdit={() => setResult(null)}
        onClose={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}

interface ActionsProps {
  showResult: boolean;
  busy: boolean;
  canSubmit: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

function DialogActions({ showResult, busy, canSubmit, onEdit, onClose, onSubmit }: ActionsProps) {
  const { t } = useTranslation();
  return (
    <div className={modalStyles.actions}>
      {showResult ? (
        <Button variant="ghost" onClick={onEdit}>
          {t('meals.proposals.editRequest')}
        </Button>
      ) : (
        <span />
      )}
      <div className={modalStyles.actionsRight}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        {!showResult && (
          <Button onClick={onSubmit} disabled={busy || !canSubmit}>
            {busy && <span className={styles.aiSpinner} aria-hidden="true" />}
            {busy ? t('meals.proposals.proposing') : t('meals.proposals.propose')}
          </Button>
        )}
      </div>
    </div>
  );
}
