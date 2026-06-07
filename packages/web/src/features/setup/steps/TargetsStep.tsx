import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/Form/NumberInput';
import { RatioPresets, PROTEIN_PRESETS, FAT_PRESETS } from '../../targets/components/RatioPresets';
import type { SetupDraft } from '../useSetup';
import styles from '../setup.module.css';

// Step 3 of the first-run wizard (B-059): the initial targets. Mirrors the Cibles ratios with
// the same clickable guidance presets; fields are pre-filled with sensible defaults (useSetup
// EMPTY) and editable. Presentational — validation lives in useSetup (`targetsValid`).
interface Props {
  draft: SetupDraft;
  set: (patch: Partial<SetupDraft>) => void;
}

export function TargetsStep({ draft, set }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <NumberInput
        label={t('setup.calorieMin')}
        suffix="kcal"
        min={0}
        value={draft.calorieMin}
        onChange={(e) => set({ calorieMin: e.target.value })}
      />
      <NumberInput
        label={t('setup.calorieMax')}
        suffix="kcal"
        min={0}
        value={draft.calorieMax}
        onChange={(e) => set({ calorieMax: e.target.value })}
      />
      <div className={styles.ratioField}>
        <NumberInput
          label={t('setup.proteinRatio')}
          suffix="g/kg"
          min={0}
          step={0.01}
          value={draft.proteinGPerKg}
          onChange={(e) => set({ proteinGPerKg: e.target.value })}
        />
        <RatioPresets presets={PROTEIN_PRESETS} onPick={(v) => set({ proteinGPerKg: v })} />
      </div>
      <div className={styles.ratioField}>
        <NumberInput
          label={t('setup.fatRatio')}
          suffix="g/kg"
          min={0}
          step={0.01}
          value={draft.fatGPerKg}
          onChange={(e) => set({ fatGPerKg: e.target.value })}
        />
        <RatioPresets presets={FAT_PRESETS} onPick={(v) => set({ fatGPerKg: v })} />
      </div>
    </>
  );
}
