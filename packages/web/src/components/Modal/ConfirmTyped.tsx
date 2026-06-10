import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Modal, modalStyles } from './Modal';
import styles from './ConfirmTyped.module.css';

// Strong "typed confirmation" modal (design/components/modals.md): the destructive action stays
// disabled until the user types the exact `word`. Used by the irreversible Données actions
// (wipe / import-replace, IMP-1). Composes the shared confirm-size Modal shell.
interface Props {
  title: string;
  word: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}

export function ConfirmTyped({
  title,
  word,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
  children,
}: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const inputId = useId();
  const matches = value.trim() === word;

  return (
    <Modal title={title} size="confirm" mobile="sheet" onClose={onCancel}>
      <div className={modalStyles.body}>
        <div className={modalStyles.text}>{children}</div>
        <label htmlFor={inputId} className={styles.prompt}>
          {t('common.typedConfirm', { word })}
        </label>
        <input
          id={inputId}
          className={styles.field}
          value={value}
          autoFocus
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches && !pending) onConfirm();
          }}
        />
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!matches || pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
