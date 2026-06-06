import { useTranslation } from 'react-i18next';
import type { EngineReadout } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { DerivedRow } from './DerivedRow';
import { GoalFields } from './GoalFields';
import { macroG } from '../format';
import type { TargetDraft } from '../draft';
import styles from '../cibles.module.css';

// Body fields of the manual-targets form (split out of TargetForm for modularity). Pure
// presentational over the draft + a setter; carbs are never a field (derived remainder).
// Compact field widths + the derived read-outs (carb ceiling, target BMI) match the mockup
// (specifications/mockups/targets.html); every derived figure comes from the engine readout.
interface TargetFieldsProps {
  draft: TargetDraft;
  set: (patch: Partial<TargetDraft>) => void;
  engine: EngineReadout;
}

export function TargetFields({ draft, set, engine }: TargetFieldsProps) {
  const { t } = useTranslation();
  const carbText =
    engine.carb_ceiling_g === null
      ? t('cibles.targets.carbPending')
      : t('cibles.targets.carbValue', { value: macroG(engine.carb_ceiling_g) });
  return (
    <>
      <div className={styles.group}>
        <div className={styles.groupTitle}>{t('cibles.targets.calorie')}</div>
        <div className={styles.grid2}>
          <NumberInput
            label={t('cibles.targets.calorieMin')}
            suffix="kcal"
            wrapperClassName={styles.inpW}
            min={0}
            value={draft.calorieMin}
            onChange={(e) => set({ calorieMin: e.target.value })}
          />
          <NumberInput
            label={t('cibles.targets.calorieMax')}
            suffix="kcal"
            wrapperClassName={styles.inpW}
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
            wrapperClassName={styles.inpW}
            min={0}
            step={0.01}
            value={draft.proteinGPerKg}
            onChange={(e) => set({ proteinGPerKg: e.target.value })}
          />
          <NumberInput
            label={t('cibles.targets.fatRatio')}
            suffix="g/kg"
            wrapperClassName={styles.inpW}
            min={0}
            step={0.01}
            value={draft.fatGPerKg}
            onChange={(e) => set({ fatGPerKg: e.target.value })}
          />
        </div>
        <DerivedRow label={t('cibles.targets.carbLabel')} value={carbText} />
        <div className="hint">{t('cibles.targets.carbNote')}</div>
      </div>

      <GoalFields draft={draft} set={set} engine={engine} />
    </>
  );
}
