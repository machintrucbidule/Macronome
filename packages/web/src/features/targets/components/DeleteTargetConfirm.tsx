import { Trans, useTranslation } from 'react-i18next';
import type { TargetVersion } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { shortDate } from '../format';

// Delete confirmation for a target version (TH-1 / B-091). Deleting a version reshapes the
// history windows (the neighbour, or the next-earliest via the retroactive-earliest rule,
// takes over its dates); already-logged days stay frozen unless the user later recomputes.
interface DeleteTargetConfirmProps {
  version: TargetVersion;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteTargetConfirm({
  version,
  pending,
  onCancel,
  onConfirm,
}: DeleteTargetConfirmProps) {
  const { t, i18n } = useTranslation();
  return (
    <Modal title={t('cibles.deleteVersion.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>
          <Trans
            i18nKey="cibles.deleteVersion.body"
            values={{ date: shortDate(version.effective_from, i18n.language) }}
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
            {t('cibles.deleteVersion.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
