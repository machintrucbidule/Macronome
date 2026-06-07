import { useTranslation } from 'react-i18next';
import type { FoodParseWarning } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import type { Draft } from './draft';
import styles from '../foods.module.css';

// The 4 per-100 g macro inputs + the "Parser macro" affordance (PM-1/B-114): a button
// that opens the paste dialog, and a discreet note listing any parse warnings.
interface MacroInputsProps {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  parseWarnings: FoodParseWarning[];
  onParse: () => void;
}

export function MacroInputs({ draft, set, parseWarnings, onParse }: MacroInputsProps) {
  const { t } = useTranslation();
  const macro = (label: string, key: 'kcal' | 'fat' | 'carb' | 'protein', suffix: string) => (
    <NumberInput
      label={
        <>
          {label} <span className="hint">/100g</span>
        </>
      }
      suffix={suffix}
      min={0}
      value={draft[key]}
      onChange={(e) => set({ [key]: e.target.value })}
    />
  );

  return (
    <>
      <div className={styles.grid4}>
        {macro(t('foods.field.kcal'), 'kcal', 'kcal')}
        {macro(t('foods.field.fat'), 'fat', 'g')}
        {macro(t('foods.field.carb'), 'carb', 'g')}
        {macro(t('foods.field.protein'), 'protein', 'g')}
      </div>

      <button type="button" className={styles.parsebtn} onClick={onParse}>
        {t('foods.parse.open')}
      </button>
      {parseWarnings.length > 0 && (
        <div className={styles.parsenote}>
          {parseWarnings.map((w) => t(`foods.parse.warning.${w}`)).join(' · ')}
        </div>
      )}
    </>
  );
}
