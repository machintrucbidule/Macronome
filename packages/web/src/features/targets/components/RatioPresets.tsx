import { useTranslation } from 'react-i18next';
import { ratio2 } from '../format';
import styles from '../targets.module.css';

// Clickable g/kg guidance presets under a protein/fat ratio field (B-007). A user landing on
// Cibles rarely knows what g/kg value to enter, so each field offers coherent suggestions with
// a plain-language legend (who the value is for). Clicking a preset fills the field — this is
// static guidance copy/values, not a nutrition computation (CLAUDE.md rule 2). The caption text
// is i18n (`targets.targets.presets.<key>`); the values are data and live here.
export interface RatioPreset {
  value: number;
  key: string;
}

// Protein: sedentary base need → active/deficit → serious athlete (author-approved, B-007).
export const PROTEIN_PRESETS: readonly RatioPreset[] = [
  { value: 0.8, key: 'proteinSedentary' },
  { value: 1.8, key: 'proteinActive' },
  { value: 2.2, key: 'proteinAthlete' },
];

// Fat: physiological floor → common balanced → higher (satiety / fat-forward diet).
export const FAT_PRESETS: readonly RatioPreset[] = [
  { value: 0.6, key: 'fatMin' },
  { value: 0.9, key: 'fatNormal' },
  { value: 1.2, key: 'fatHigh' },
];

interface RatioPresetsProps {
  presets: readonly RatioPreset[];
  /** Fills the bound field with the picked value (canonical dot-decimal string). */
  onPick: (value: string) => void;
}

export function RatioPresets({ presets, onPick }: RatioPresetsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.presets}>
      <span className="hint">{t('targets.targets.presets.hint')}</span>
      <div className={styles.presetList}>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            className={styles.presetBtn}
            onClick={() => onPick(String(p.value))}
            aria-label={t('targets.targets.presets.aria', { value: ratio2(p.value) })}
          >
            <span className={styles.presetVal}>{ratio2(p.value)} g/kg</span>
            <span className={styles.presetCaption}>{t(`targets.targets.presets.${p.key}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
