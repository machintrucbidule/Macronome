import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';
import { useMeals } from '../../MealsContext';
import type { CustomTarget, CustomValues } from '../../hooks/useMealsController';
import styles from '../modals.module.css';

// Manual-entry line editor (specifications/screens/meals.md §Custom inline). Total values of
// what was eaten (not per 100 g); served weight optional (enables leftover deduction). Not
// stored in the foods catalog — it is a per-day inline entry.
interface CustomFoodModalProps {
  target: CustomTarget;
  initial: CustomValues | null;
}

const numOr0 = (s: string): number => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function CustomFoodModal({ target, initial }: CustomFoodModalProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '');
  const [weight, setWeight] = useState(initial?.servedGrams ? String(initial.servedGrams) : '');
  const [fat, setFat] = useState(initial ? String(initial.snap.fat) : '');
  const [carb, setCarb] = useState(initial ? String(initial.snap.carb) : '');
  const [protein, setProtein] = useState(initial ? String(initial.snap.protein) : '');

  const save = (): void => {
    const k = numOr0(kcal);
    const w = numOr0(weight);
    void actions.saveCustom(target, {
      name: name.trim() || t('meals.custom.defaultName'),
      kcal: k,
      servedGrams: w > 0 ? w : null,
      snap: { kcal: k, fat: numOr0(fat), carb: numOr0(carb), protein: numOr0(protein) },
    });
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opt = false,
    full = false,
  ) => (
    <div className={`${styles.cuField} ${full ? styles.full : ''}`}>
      <label>
        {label}
        {opt && <span className={styles.opt}> {t('common.optional')}</span>}
      </label>
      <input
        className={full ? '' : 'num'}
        type={full ? 'text' : 'number'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <Modal
      title={t(initial ? 'meals.custom.editTitle' : 'meals.custom.addTitle')}
      onClose={actions.closeCustom}
    >
      <div className={modalStyles.body}>
        <p className={styles.sub}>{t('meals.custom.sub')}</p>
        <div className={styles.cuGrid}>
          {field(t('meals.custom.name'), name, setName, false, true)}
          {field(t('meals.card.calories'), kcal, setKcal)}
          {field(t('meals.custom.weight'), weight, setWeight, true)}
          {field(t('meals.card.fat'), fat, setFat)}
          {field(t('meals.card.carb'), carb, setCarb)}
          {field(t('meals.card.protein'), protein, setProtein)}
        </div>
      </div>
      <div className={modalStyles.actions}>
        <Button variant="ghost" onClick={actions.closeCustom}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={save}>
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
}
