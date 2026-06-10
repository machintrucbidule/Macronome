import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import { TextInput } from '../../../components/Form/TextInput';
import { NumberInput } from '../../../components/Form/NumberInput';
import { useContainerMutations } from '../useContainers';
import styles from '../containers.module.css';

// Add/edit a container (screens/containers.md): name + empty weight (g). Delete is offered
// in edit mode (free — leftover history froze its value). A 409 surfaces a duplicate name.
interface Props {
  container: Container | null;
  onClose: () => void;
  onDelete: (c: Container) => void;
  // Mobile-only Modal variant (mobile-responsive follow-up): the add/edit form opens as a bottom
  // sheet ≤560px (owner decision — like the other account-page popups). Inert on desktop — Modal
  // applies the variant only when its own useIsMobile() is true.
  mobile?: 'fullscreen' | 'sheet';
}

export function ContainerModal({ container, onClose, onDelete, mobile }: Props) {
  const { t } = useTranslation();
  const { create, update } = useContainerMutations();
  const [name, setName] = useState(container?.name ?? '');
  const [weight, setWeight] = useState(container ? String(container.empty_weight_g) : '');
  const [error, setError] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    const grams = Number(weight);
    if (!name.trim() || Number.isNaN(grams) || grams < 0) return;
    const body = { name: name.trim(), empty_weight_g: grams };
    try {
      if (container) await update.mutateAsync({ id: container.id, body });
      else await create.mutateAsync(body);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? t('containers.duplicate') : null);
    }
  };

  return (
    <Modal
      title={t(container ? 'containers.modal.editTitle' : 'containers.modal.addTitle')}
      size="confirm"
      {...(mobile ? { mobile } : {})}
      onClose={onClose}
    >
      <div className={styles.modalBody}>
        <TextInput
          label={t('containers.field.name')}
          placeholder={t('containers.field.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <NumberInput
          label={t('containers.field.weight')}
          suffix="g"
          min={0}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <span className={styles.hint}>{t('containers.modal.hint')}</span>
        {error && <span className={styles.error}>{error}</span>}
      </div>
      <div className={styles.modalActions}>
        {container && (
          <Button
            variant="danger"
            className={styles.spacerAction}
            onClick={() => onDelete(container)}
          >
            {t('common.remove')}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={create.isPending || update.isPending}
          onClick={() => void save()}
        >
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
}
