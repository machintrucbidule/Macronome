import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RATING_LABEL_KEYS, type RecipeBulkPatch } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import {
  BulkRatingSelect,
  BulkRecap,
  bulkRatingValue,
  type BulkRatingKey,
} from '../../../components/BulkEdit';
import styles from '../recipes.module.css';

// Batch popup for 2+ selected recipes (BE-1/B-308). One field: the Note. A recipe's other
// editable values rebuild its derived food, so setting them across a selection would move the
// per-portion and per-100 g figures of every recipe touched — deliberately out of scope (owner).
interface Props {
  count: number;
  onClose: () => void;
  onApply: (patch: RecipeBulkPatch) => void;
}

export function RecipeBulkModal({ count, onClose, onApply }: Props) {
  const { t } = useTranslation();
  const [rating, setRating] = useState<BulkRatingKey>('keep');
  const [confirming, setConfirming] = useState(false);
  const value = bulkRatingValue(rating);
  const countLabel = t('recipes.count', { count });

  if (confirming) {
    return (
      <BulkRecap
        countLabel={countLabel}
        changes={[
          {
            label: t('recipes.col.rating'),
            value: value === null ? t('rating.unrated') : t(RATING_LABEL_KEYS[value ?? 0]),
          },
        ]}
        onCancel={() => setConfirming(false)}
        onConfirm={() => onApply({ rating: value })}
      />
    );
  }

  return (
    <Modal title={t('bulk.title')} onClose={onClose}>
      <div className={modalStyles.body}>
        <p className={modalStyles.sub}>{t('bulk.sub', { what: countLabel })}</p>
        <div className={styles.bulkFields}>
          <div>
            <div className={styles.segLabel}>{t('recipes.col.rating')}</div>
            <BulkRatingSelect
              value={rating}
              onChange={setRating}
              ariaLabel={t('recipes.col.rating')}
            />
          </div>
        </div>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={value === undefined}>
            {t('bulk.continue')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
