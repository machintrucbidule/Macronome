import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateWeighInRequest, DietFlag } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import { WeighInFields, type WeighInDraft } from './WeighInFields';
import type { WeighInModalTarget } from '../useWeightController';
import { useWeightMutations } from '../useWeight';
import styles from '../weight.module.css';

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface WeighInModalProps {
  target: Exclude<WeighInModalTarget, null>;
  defaultFlag: DietFlag;
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

export function WeighInModal({ target, defaultFlag, onClose }: WeighInModalProps) {
  const { t } = useTranslation();
  const initial = target.kind === 'edit' ? target.weighIn : null;
  const { create, patch, remove } = useWeightMutations();
  const [draft, setDraft] = useState<WeighInDraft>(() => ({
    date: initial?.date ?? todayIso(),
    weight: initial ? String(initial.weight_kg) : '',
    waist: initial?.waist_cm != null ? String(initial.waist_cm) : '',
    flag: initial?.diet_flag ?? defaultFlag,
    note: initial?.note ?? '',
  }));
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patchDraft: Partial<WeighInDraft>): void =>
    setDraft((d) => ({ ...d, ...patchDraft }));

  const pending = create.isPending || patch.isPending || remove.isPending;
  const canSave = draft.weight !== '' && Number(draft.weight) > 0 && DATE_RE.test(draft.date);
  const values = (): Omit<CreateWeighInRequest, 'date'> => ({
    weight_kg: Number(draft.weight),
    waist_cm: draft.waist === '' ? null : Number(draft.waist),
    diet_flag: draft.flag,
    note: draft.note === '' ? null : draft.note,
  });

  const save = async (): Promise<void> => {
    setError(null);
    try {
      if (initial)
        await patch.mutateAsync({ id: initial.id, body: { date: draft.date, ...values() } });
      else await create.mutateAsync({ date: draft.date, ...values() });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'weigh_in_date_occupied')
        setConflictId(e.details?.existing_id ?? null);
      else setError(e instanceof ApiError ? e.code : 'error');
    }
  };
  const replace = async (): Promise<void> => {
    if (conflictId) await patch.mutateAsync({ id: conflictId, body: values() });
    onClose();
  };
  const del = async (): Promise<void> => {
    if (initial) await remove.mutateAsync(initial.id);
    onClose();
  };

  const title = t(initial ? 'weight.modal.editTitle' : 'weight.modal.addTitle');
  if (conflictId) {
    return (
      <ConflictConfirm
        title={title}
        date={draft.date}
        pending={pending}
        onCancel={() => setConflictId(null)}
        onReplace={() => void replace()}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <WeighInFields draft={draft} set={set} error={error} />
      <div className={styles.modalActions}>
        {initial ? (
          <Button variant="danger" disabled={pending} onClick={() => void del()}>
            {t('common.remove')}
          </Button>
        ) : (
          <span />
        )}
        <div className={styles.modalActionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSave || pending} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
