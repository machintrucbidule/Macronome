import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { NumberInput } from '../../../components/Form/NumberInput';
import { useTargetMutations } from '../useTargets';
import { kcal } from '../format';
import styles from '../cibles.module.css';

// "Suggérer une cible depuis le déficit visé" (opt-in). Proposes a calorie range from
// the recent-avg burn minus a desired deficit; it never writes — on Apply it only
// pre-fills the left-column min/max, still editable before Save.
interface SuggestDialogProps {
  onClose: () => void;
  onApply: (calorieMin: number, calorieMax: number) => void;
}

export function SuggestDialog({ onClose, onApply }: SuggestDialogProps) {
  const { t } = useTranslation();
  const { suggest } = useTargetMutations();
  const [deficit, setDeficit] = useState('-300');
  const proposed = suggest.data ?? null;

  return (
    <Modal title={t('cibles.suggest.title')} size="confirm" onClose={onClose}>
      <div className={modalStyles.body}>
        <NumberInput
          label={t('cibles.suggest.deficit')}
          suffix="kcal/j"
          value={deficit}
          onChange={(e) => setDeficit(e.target.value)}
        />
        <Button
          variant="ghost"
          onClick={() => suggest.mutate({ desired_deficit: Number(deficit) })}
          disabled={suggest.isPending}
        >
          {t('cibles.suggest.compute')}
        </Button>
        {suggest.isError && <div className={styles.error}>{t('cibles.suggest.noWeight')}</div>}
        {proposed && (
          <div className={styles.proposed}>
            {t('cibles.suggest.proposed', {
              min: kcal(proposed.calorie_min),
              max: kcal(proposed.calorie_max),
            })}
          </div>
        )}
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => proposed && onApply(proposed.calorie_min, proposed.calorie_max)}
            disabled={!proposed}
          >
            {t('cibles.suggest.apply')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
