import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { modalStyles } from '../../../components/Modal/Modal';
import styles from './modals.module.css';

// Footer for the AI-proposals dialog (B-123). One row per flow state: request (Proposer), result
// (Modifier la demande · Autres idées), refine (‹ Retour · Relancer), applied (Fermer). Purely
// presentational — every handler is owned by the dialog.
export type Mode = 'request' | 'result' | 'refine' | 'applied';

interface Props {
  mode: Mode;
  busy: boolean;
  canSubmit: boolean;
  onEdit: () => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function DialogActions({ mode, busy, canSubmit, onEdit, onBack, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  if (mode === 'applied') {
    return (
      <div className={modalStyles.actions}>
        <span />
        <Button onClick={onClose}>{t('common.close')}</Button>
      </div>
    );
  }
  const submitLabel = busy
    ? t('meals.proposals.proposing')
    : mode === 'result'
      ? t('meals.proposals.regenerate')
      : mode === 'refine'
        ? t('meals.proposals.refine.relaunch')
        : t('meals.proposals.propose');
  return (
    <div className={modalStyles.actions}>
      {mode === 'result' ? (
        <Button variant="ghost" onClick={onEdit} disabled={busy}>
          {t('meals.proposals.editRequest')}
        </Button>
      ) : mode === 'refine' ? (
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          {t('meals.proposals.refine.back')}
        </Button>
      ) : (
        <span />
      )}
      <div className={modalStyles.actionsRight}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={busy || (mode === 'request' && !canSubmit)}>
          {busy && <span className={styles.aiSpinner} aria-hidden="true" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
