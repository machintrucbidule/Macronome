import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../Modal/Modal';
import { Button } from '../Button/Button';
import styles from './BulkEdit.module.css';

// The recap that confirms a batch edit before it writes (BE-1, design/components/modals.md).
// The house rule is that a flow overwriting existing content confirms first; what makes this one a
// *recap* rather than a bare confirmation is that it states WHAT is about to change, not only how
// many rows — the rows themselves are mostly off-screen in a paginated list.

/** One line of the recap: the field's label and the value it is about to take. */
export interface BulkChange {
  label: string;
  value: string;
}

interface Props {
  /** How many rows the batch will touch, already worded by the caller ("37 aliments"). */
  countLabel: string;
  /** Only the fields the user actually set — the ones left on « Ne pas modifier » are absent
   *  here exactly as they are absent from the request. */
  changes: BulkChange[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function BulkRecap({ countLabel, changes, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('bulk.recap.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('bulk.recap.intro', { what: countLabel })}</p>
        <ul className={styles.recapList}>
          {changes.map((c) => (
            <li key={c.label}>
              <span className={styles.recapLabel}>{c.label}</span>
              <span className={styles.recapValue}>{c.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm}>{t('bulk.apply')}</Button>
        </div>
      </div>
    </Modal>
  );
}
