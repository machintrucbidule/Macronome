import { useTranslation } from 'react-i18next';
import type { DietFlag } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { TextInput } from '../../../components/Form/TextInput';
import { FlagToggle } from './FlagToggle';
import { HaImportButton } from './HaImportButton';
import styles from '../weight.module.css';

export interface WeighInDraft {
  date: string;
  weight: string;
  waist: string;
  flag: DietFlag;
  note: string;
}

interface WeighInFieldsProps {
  draft: WeighInDraft;
  set: (patch: Partial<WeighInDraft>) => void;
  error: string | null;
  /** Open-interval mode (B-176): only régime + note are editable (date/weight/waist hidden). */
  openMode?: boolean;
  /** Add mode (B-180): shows the HA import button (itself gated on the HA config). */
  addMode?: boolean;
}

// Presentational form body for the weigh-in modal (date, weight, optional waist, the diet
// flag for the period ending here, note). State lives in WeighInModal. In `openMode` only the
// régime toggle + note show (the open interval has no measurement — B-176).
export function WeighInFields({ draft, set, error, openMode, addMode }: WeighInFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.modalBody}>
      {!openMode && (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('weight.field.date')}</span>
            <input
              type="date"
              className={styles.dateInput}
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </label>
          <NumberInput
            label={t('weight.field.weight')}
            suffix="kg"
            value={draft.weight}
            onChange={(e) => set({ weight: e.target.value })}
          />
          {addMode && (
            <HaImportButton
              date={draft.date}
              onWeight={(weightKg) => set({ weight: String(weightKg) })}
            />
          )}
          <NumberInput
            label={`${t('weight.field.waist')} ${t('common.optional')}`}
            suffix="cm"
            value={draft.waist}
            onChange={(e) => set({ waist: e.target.value })}
          />
        </>
      )}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('weight.field.flag')}</span>
        <FlagToggle value={draft.flag} onChange={(flag) => set({ flag })} />
      </label>
      <TextInput
        label={t('weight.field.note')}
        value={draft.note}
        onChange={(e) => set({ note: e.target.value })}
      />
      {error && <p className={styles.error}>{t('weight.modal.error', { code: error })}</p>}
    </div>
  );
}
