import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DietFlag } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import { WeighInFields, type WeighInDraft } from './WeighInFields';
import { useWeighInActions } from './useWeighInActions';
import type { WeighInModalTarget } from '../useWeightController';
import styles from '../weight.module.css';

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface WeighInModalProps {
  target: Exclude<WeighInModalTarget, null>;
  defaultFlag: DietFlag;
  /** The persisted open-period note (B-176): the open mode's note + the add-modal note prefill. */
  openNote?: string | null;
  onClose: () => void;
}

// One-per-day confirmation: posting onto an occupied date returns 409 + existing_id; we then
// offer to replace that day's weigh-in (a PATCH on the existing id), per screens/weight.md.
function ConflictConfirm(props: {
  title: string;
  date: string;
  pending: boolean;
  onCancel: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={props.title} size="confirm" onClose={props.onClose}>
      <div className={styles.modalBody}>
        <p>{t('weight.modal.occupied', { date: props.date })}</p>
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={props.onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" disabled={props.pending} onClick={props.onReplace}>
          {t('weight.modal.replace')}
        </Button>
      </div>
    </Modal>
  );
}

export function WeighInModal({ target, defaultFlag, openNote, onClose }: WeighInModalProps) {
  const { t } = useTranslation();
  const initial = target.kind === 'edit' ? target.weighIn : null;
  const [draft, setDraft] = useState<WeighInDraft>(() => ({
    date: initial?.date ?? todayIso(),
    weight: initial ? String(initial.weight_kg) : '',
    waist: initial?.waist_cm != null ? String(initial.waist_cm) : '',
    flag: initial?.diet_flag ?? defaultFlag,
    // add + open pre-fill the note from the persisted open-period note; edit keeps its own.
    note: initial ? (initial.note ?? '') : (openNote ?? ''),
  }));
  const set = (patchDraft: Partial<WeighInDraft>): void =>
    setDraft((d) => ({ ...d, ...patchDraft }));
  const a = useWeighInActions(target, draft, openNote, onClose);

  // Open mode always saves (note optional); add/edit need a positive weight + a valid date.
  const canSave =
    a.isOpen || (draft.weight !== '' && Number(draft.weight) > 0 && DATE_RE.test(draft.date));
  const title = t(
    a.isOpen
      ? 'weight.modal.openTitle'
      : a.initial
        ? 'weight.modal.editTitle'
        : 'weight.modal.addTitle',
  );
  if (a.conflictId) {
    return (
      <ConflictConfirm
        title={title}
        date={draft.date}
        pending={a.pending}
        onCancel={a.clearConflict}
        onReplace={() => void a.replace()}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <WeighInFields draft={draft} set={set} error={a.error} openMode={a.isOpen} />
      <div className={styles.modalActions}>
        {a.initial ? (
          <Button variant="danger" disabled={a.pending} onClick={() => void a.del()}>
            {t('common.remove')}
          </Button>
        ) : (
          <span />
        )}
        <div className={styles.modalActionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!canSave || a.pending}
            onClick={() => void (a.isOpen ? a.saveOpen() : a.save())}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
