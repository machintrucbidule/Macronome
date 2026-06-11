import { Trans, useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Strong confirmation for the opt-in, auto-only recompute (TH-1 / B-091). Recompute is an
// explicit exception to the freeze rule: it re-freezes target_snapshot + recomputes the
// auto verdict for logged days with no manual override in the version's period. Forced
// days are left untouched — the body spells this out so the action is never accidental.
interface RecomputeConfirmProps {
  count: number;
  periodLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RecomputeConfirm({
  count,
  periodLabel,
  pending,
  onCancel,
  onConfirm,
}: RecomputeConfirmProps) {
  const { t } = useTranslation();
  return (
    <Modal title={t('cibles.recompute.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>
          <Trans
            i18nKey="cibles.recompute.body"
            values={{ count, period: periodLabel }}
            components={{ b: <b /> }}
          />
        </p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {t('cibles.recompute.confirm', { count })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
