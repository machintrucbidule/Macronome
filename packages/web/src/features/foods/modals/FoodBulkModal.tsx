import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodBulkPatch, FoodSource } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { BulkRecap } from '../../../components/BulkEdit';
import { FoodBulkFields } from './FoodBulkFields';
import { draftChanges, draftToPatch, emptyBulkDraft, isEmptyDraft } from './bulk-draft';
import styles from '../foods.module.css';

// Batch popup for 2+ selected foods (BE-1). Opens with every field on « Ne pas modifier », so
// pressing Appliquer straight away is impossible — there would be nothing to apply. Confirming
// goes through the recap (D11), which states what is about to change: the rows are mostly
// off-screen in a paginated list, so nothing inline could show it.
interface Props {
  count: number;
  presentSources: FoodSource[];
  onClose: () => void;
  onApply: (patch: FoodBulkPatch) => void;
}

export function FoodBulkModal({ count, presentSources, onClose, onApply }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyBulkDraft);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<typeof draft>): void => setDraft((d) => ({ ...d, ...patch }));
  const countLabel = t('foods.count', { count });

  if (confirming) {
    return (
      <BulkRecap
        countLabel={countLabel}
        changes={draftChanges(draft, t)}
        onCancel={() => setConfirming(false)}
        onConfirm={() => onApply(draftToPatch(draft))}
      />
    );
  }

  return (
    <Modal title={t('bulk.title')} onClose={onClose}>
      <div className={modalStyles.body}>
        <p className={modalStyles.sub}>{t('bulk.sub', { what: countLabel })}</p>
        <div className={styles.bulkFields}>
          <FoodBulkFields draft={draft} presentSources={presentSources} set={set} />
        </div>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={isEmptyDraft(draft)}>
            {t('bulk.continue')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
