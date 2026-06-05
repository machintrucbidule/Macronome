import { useTranslation } from 'react-i18next';
import type { Sex } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import type { SetupDraft } from '../useSetup';
import styles from '../setup.module.css';

// Step 2 of the first-run wizard: the metabolic profile (sex / birth date / height) the
// engine needs. Presentational — validation lives in useSetup.
interface Props {
  draft: SetupDraft;
  set: (patch: Partial<SetupDraft>) => void;
}

export function ProfileStep({ draft, set }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>{t('setup.sex')}</span>
        <select
          className={styles.select}
          value={draft.sex}
          onChange={(e) => set({ sex: e.target.value as Sex })}
        >
          <option value="" disabled>
            {t('setup.sexPlaceholder')}
          </option>
          <option value="male">{t('setup.male')}</option>
          <option value="female">{t('setup.female')}</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{t('setup.birthdate')}</span>
        <input
          type="date"
          className={styles.select}
          value={draft.birthdate}
          onChange={(e) => set({ birthdate: e.target.value })}
        />
      </label>
      <NumberInput
        label={t('setup.height')}
        suffix="cm"
        min={0}
        value={draft.heightCm}
        onChange={(e) => set({ heightCm: e.target.value })}
      />
    </>
  );
}
