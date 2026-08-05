import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/Form/NumberInput';
import { SelectMenu } from '../../../components/SelectMenu/SelectMenu';
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
        <SelectMenu
          variant="field"
          // The trigger is a button, so the wrapping <label> does not name it — say it outright.
          ariaLabel={t('setup.sex')}
          value={draft.sex}
          placeholder={t('setup.sexPlaceholder')}
          options={[
            { value: 'male', label: t('setup.male') },
            { value: 'female', label: t('setup.female') },
          ]}
          onChange={(sex) => set({ sex })}
        />
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
