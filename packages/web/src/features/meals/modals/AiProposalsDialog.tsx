import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayDetail, MealProposal, MealSuggestions } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { ApiError } from '../../../api/client';
import { useMealSuggestions } from '../hooks/useMealSuggestions';
import {
  accumulateAvoid,
  buildConstraints,
  type ExcludedFood,
  type PinnedLine,
} from '../logic/refineConstraints';
import { RequestStep } from './RequestStep';
import { ProposalsList } from './ProposalsList';
import { RefinePanel } from './RefinePanel';
import styles from './modals.module.css';

// "Proposition IA" dialog (mockup states 2–5, B-123). Pick meals + precisions → POST
// /ai/meal-suggestions, render the certified proposals (state 4) read-only, then "Raffiner" a
// proposal (state 5, Slice 11): exclude/pin/precisions accumulate client-side and re-send on every
// call (§2.6), with `avoid` signatures of seen proposals for variety. "Choisir" (apply, Slice 12)
// is still deferred. The day targets are never mutated client-side; totals stay server-certified.
const KNOWN_ERRORS = new Set([
  'ai_not_configured',
  'ai_unauthorized',
  'ai_unreachable',
  'ai_bad_response',
  'ai_rate_limited',
  'ai_unavailable',
]);

type Mode = 'request' | 'result' | 'refine';

function useMealProposals(date: string) {
  const [mealIds, setMealIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [result, setResult] = useState<MealSuggestions | null>(null);
  const [refineProposal, setRefineProposal] = useState<MealProposal | null>(null);
  const [excluded, setExcluded] = useState<ExcludedFood[]>([]);
  const [pinned, setPinned] = useState<PinnedLine[]>([]);
  const [avoid, setAvoid] = useState<string[][]>([]);
  const suggest = useMealSuggestions();

  const busy = suggest.isPending;
  const canSubmit = mealIds.length >= 1;
  const mode: Mode = refineProposal ? 'refine' : result ? 'result' : 'request';

  const toggleMeal = (id: string): void =>
    setMealIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const openRefine = (p: MealProposal): void => {
    setErrorCode(null);
    setRefineProposal(p);
  };

  const submit = (): void => {
    if (!canSubmit || busy) return;
    setErrorCode(null);
    setErrorDetail(null);
    const constraints = buildConstraints(excluded, pinned, avoid);
    suggest.mutate(
      {
        date,
        meal_ids: mealIds,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(constraints ? { constraints } : {}),
      },
      {
        onSuccess: (res) => {
          setResult(res.data);
          setRefineProposal(null);
          setAvoid((cur) => accumulateAvoid(cur, res.data.proposals));
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : 'ai_bad_response';
          setErrorCode(KNOWN_ERRORS.has(code) ? code : 'ai_bad_response');
          setErrorDetail(err instanceof ApiError ? (err.details?.provider_message ?? null) : null);
        },
      },
    );
  };

  return {
    mealIds,
    toggleMeal,
    note,
    setNote,
    errorCode,
    errorDetail,
    result,
    refineProposal,
    excluded,
    setExcluded,
    pinned,
    setPinned,
    busy,
    canSubmit,
    mode,
    submit,
    openRefine,
    setResult,
    setRefineProposal,
  };
}

interface Props {
  day: DayDetail;
  date: string;
  onClose: () => void;
}

export function AiProposalsDialog({ day, date, onClose }: Props) {
  const { t } = useTranslation();
  const f = useMealProposals(date);

  return (
    <Modal
      title={t('meals.proposals.title')}
      size={f.mode === 'request' ? 'md' : 'wide'}
      onClose={onClose}
    >
      <div className={modalStyles.body}>
        <DialogBody
          busy={f.busy}
          day={day}
          refineProposal={f.refineProposal}
          result={f.result}
          mealIds={f.mealIds}
          onToggleMeal={f.toggleMeal}
          note={f.note}
          onNoteChange={f.setNote}
          excluded={f.excluded}
          setExcluded={f.setExcluded}
          pinned={f.pinned}
          setPinned={f.setPinned}
          onRefine={f.openRefine}
        />
        {f.errorCode && !f.busy && (
          <Banner tone="warning">
            {t(`meals.proposals.errors.${f.errorCode}`)}
            {f.errorDetail && <span className={styles.aiErrDetail}>{f.errorDetail}</span>}
          </Banner>
        )}
      </div>

      <DialogActions
        mode={f.mode}
        busy={f.busy}
        canSubmit={f.canSubmit}
        onEdit={() => f.setResult(null)}
        onBack={() => f.setRefineProposal(null)}
        onClose={onClose}
        onSubmit={f.submit}
      />
    </Modal>
  );
}

interface BodyProps {
  busy: boolean;
  day: DayDetail;
  refineProposal: MealProposal | null;
  result: MealSuggestions | null;
  mealIds: string[];
  onToggleMeal: (id: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  excluded: ExcludedFood[];
  setExcluded: Dispatch<SetStateAction<ExcludedFood[]>>;
  pinned: PinnedLine[];
  setPinned: Dispatch<SetStateAction<PinnedLine[]>>;
  onRefine: (proposal: MealProposal) => void;
}

function DialogBody(props: BodyProps) {
  const { t } = useTranslation();
  if (props.busy) {
    return (
      <div className={styles.proposalsBusy}>
        <span className={styles.aiSpinner} aria-hidden="true" />
        {t('meals.proposals.busy')}
      </div>
    );
  }
  if (props.refineProposal) {
    return (
      <RefinePanel
        proposal={props.refineProposal}
        day={props.day}
        excluded={props.excluded}
        setExcluded={props.setExcluded}
        pinned={props.pinned}
        setPinned={props.setPinned}
        note={props.note}
        onNoteChange={props.onNoteChange}
      />
    );
  }
  if (props.result) {
    return (
      <ProposalsList proposals={props.result.proposals} day={props.day} onRefine={props.onRefine} />
    );
  }
  return (
    <RequestStep
      day={props.day}
      mealIds={props.mealIds}
      onToggleMeal={props.onToggleMeal}
      note={props.note}
      onNoteChange={props.onNoteChange}
      disabled={props.busy}
    />
  );
}

interface ActionsProps {
  mode: Mode;
  busy: boolean;
  canSubmit: boolean;
  onEdit: () => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

function DialogActions({ mode, busy, canSubmit, onEdit, onBack, onClose, onSubmit }: ActionsProps) {
  const { t } = useTranslation();
  return (
    <div className={modalStyles.actions}>
      {mode === 'result' ? (
        <Button variant="ghost" onClick={onEdit}>
          {t('meals.proposals.editRequest')}
        </Button>
      ) : mode === 'refine' ? (
        <Button variant="ghost" onClick={onBack}>
          {t('meals.proposals.refine.back')}
        </Button>
      ) : (
        <span />
      )}
      <div className={modalStyles.actionsRight}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        {mode !== 'result' && (
          <Button onClick={onSubmit} disabled={busy || !canSubmit}>
            {busy && <span className={styles.aiSpinner} aria-hidden="true" />}
            {busy
              ? t('meals.proposals.proposing')
              : mode === 'refine'
                ? t('meals.proposals.refine.relaunch')
                : t('meals.proposals.propose')}
          </Button>
        )}
      </div>
    </div>
  );
}
