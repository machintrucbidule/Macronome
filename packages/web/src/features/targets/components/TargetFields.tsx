import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/Form/NumberInput';
import type { TargetDraft } from '../draft';
import styles from '../cibles.module.css';

// Body fields of the manual-targets form (split out of TargetForm for modularity). Pure
// presentational over the draft + a setter; carbs are never a field (derived remainder).
interface TargetFieldsProps {
  draft: TargetDraft;
  set: (patch: Partial<TargetDraft>) => void;
}

export function TargetFields({ draft, set }: TargetFieldsProps) {
  const { t } = useTranslation();
  const optional = (
    <>
      {' '}
      <span className="hint">{t('common.optional')}</span>
    </>
  );

  return (
    <>
      <div className={styles.group}>
        <div className={styles.groupTitle}>{t('cibles.targets.calorie')}</div>
        <div className={styles.grid2}>
          <NumberInput
            label={t('cibles.targets.calorieMin')}
            suffix="kcal"
            min={0}
            value={draft.calorieMin}
            onChange={(e) => set({ calorieMin: e.target.value })}
          />
          <NumberInput
            label={t('cibles.targets.calorieMax')}
            suffix="kcal"
            min={0}
            value={draft.calorieMax}
            onChange={(e) => set({ calorieMax: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t('cibles.targets.ratios')}</div>
        <div className={styles.grid2}>
          <NumberInput
            label={t('cibles.targets.proteinRatio')}
            suffix="g/kg"
            min={0}
            step={0.01}
            value={draft.proteinGPerKg}
            onChange={(e) => set({ proteinGPerKg: e.target.value })}
          />
          <NumberInput
            label={t('cibles.targets.fatRatio')}
            suffix="g/kg"
            min={0}
            step={0.01}
            value={draft.fatGPerKg}
            onChange={(e) => set({ fatGPerKg: e.target.value })}
          />
        </div>
        <div className="hint">{t('cibles.targets.carbNote')}</div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t('cibles.targets.goal')}</div>
        <div className={styles.grid2}>
          <NumberInput
            label={
              <>
                {t('cibles.targets.targetWeight')}
                {optional}
              </>
            }
            suffix="kg"
            min={0}
            step={0.1}
            value={draft.targetWeightKg}
            onChange={(e) => set({ targetWeightKg: e.target.value })}
          />
          <NumberInput
            label={
              <>
                {t('cibles.targets.rate')}
                {optional}
              </>
            }
            suffix="kg/sem"
            min={0}
            step={0.01}
            value={draft.rateKgPerWeek}
            onChange={(e) => set({ rateKgPerWeek: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}
