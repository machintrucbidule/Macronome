import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DishPhotoMacros } from '@macronome/shared';
import { Modal, modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';
import { useMeals } from '../../MealsContext';
import type { CustomTarget, CustomValues } from '../../hooks/useMealsController';
import { AiDishAnalysisDialog } from '../AiDishAnalysisDialog';
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

interface CuFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  opt?: boolean;
  full?: boolean;
}

function CuField({ id, label, value, onChange, opt = false, full = false }: CuFieldProps) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.cuField} ${full ? styles.full : ''}`}>
      <label htmlFor={id}>
        {label}
        {opt && <span className={styles.opt}> {t('common.optional')}</span>}
      </label>
      <input
        id={id}
        className={full ? '' : 'num'}
        type={full ? 'text' : 'number'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function CustomFoodModal({ target, initial }: CustomFoodModalProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const fieldId = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '');
  const [weight, setWeight] = useState(initial?.servedGrams ? String(initial.servedGrams) : '');
  const [fat, setFat] = useState(initial ? String(initial.snap.fat) : '');
  const [carb, setCarb] = useState(initial ? String(initial.snap.carb) : '');
  const [protein, setProtein] = useState(initial ? String(initial.snap.protein) : '');
  const [showAi, setShowAi] = useState(false);

  const isValid = numOr0(kcal) > 0;

  // Pre-fill the six fields from the AI estimate (1:1 totals — spec/logic/ai-dish-photo-macros.md §5).
  const applyAnalysis = (r: DishPhotoMacros): void => {
    setName(r.dish_name);
    setKcal(String(r.kcal));
    setWeight(String(r.weight_g));
    setFat(String(r.fat_g));
    setCarb(String(r.carb_g));
    setProtein(String(r.protein_g));
    setShowAi(false);
  };

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

  // Enter submits when the form is valid (B-087); no-op otherwise. The Modal is a div, not a
  // <form>, so the key is caught on the body wrapper rather than via native form submission.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && isValid) {
      e.preventDefault();
      save();
    }
  };

  const fid = (key: string): string => `${fieldId}-${key}`;

  return (
    <Modal
      title={t(initial ? 'meals.custom.editTitle' : 'meals.custom.addTitle')}
      onClose={actions.closeCustom}
    >
      <div className={modalStyles.body} onKeyDown={onKeyDown}>
        <p className={styles.sub}>{t('meals.custom.sub')}</p>
        <div className={styles.cuAi}>
          <Button variant="ghost" onClick={() => setShowAi(true)}>
            {t('meals.aiAnalysis.button')}
          </Button>
        </div>
        <div className={styles.cuGrid}>
          <CuField
            id={fid('name')}
            label={t('meals.custom.name')}
            value={name}
            onChange={setName}
            full
          />
          <CuField
            id={fid('kcal')}
            label={t('meals.card.calories')}
            value={kcal}
            onChange={setKcal}
          />
          <CuField
            id={fid('weight')}
            label={t('meals.custom.weight')}
            value={weight}
            onChange={setWeight}
            opt
          />
          <CuField id={fid('fat')} label={t('meals.card.fat')} value={fat} onChange={setFat} />
          <CuField id={fid('carb')} label={t('meals.card.carb')} value={carb} onChange={setCarb} />
          <CuField
            id={fid('protein')}
            label={t('meals.card.protein')}
            value={protein}
            onChange={setProtein}
          />
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
      {showAi && (
        <AiDishAnalysisDialog onApplied={applyAnalysis} onClose={() => setShowAi(false)} />
      )}
    </Modal>
  );
}
