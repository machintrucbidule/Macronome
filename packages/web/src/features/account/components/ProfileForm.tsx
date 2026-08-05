import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile, Sex } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { Button } from '../../../components/Button/Button';
import { SelectMenu } from '../../../components/SelectMenu/SelectMenu';
import { useProfileMutation } from '../useProfile';
import styles from '../account.module.css';

// Metabolic profile (sex / birth date / height) — the Compte screen is its home (B-060). Edits
// PATCH /profile and invalidate the Cibles engine readout (age is derived server-side).
interface ProfileDraft {
  sex: Sex;
  birthdate: string;
  heightCm: string;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const mutation = useProfileMutation();
  const [draft, setDraft] = useState<ProfileDraft>({
    sex: profile.sex,
    birthdate: profile.birthdate,
    heightCm: String(profile.height_cm),
  });

  const save = (): void => {
    mutation.mutate({
      sex: draft.sex,
      birthdate: draft.birthdate,
      height_cm: Number(draft.heightCm),
    });
  };

  return (
    <>
      <div className={styles.row}>
        <span className={styles.lab}>{t('account.info.sex')}</span>
        <SelectMenu
          variant="field"
          wrapClassName={styles.selectWrap}
          ariaLabel={t('account.info.sex')}
          value={draft.sex}
          options={[
            { value: 'male', label: t('account.info.male') },
            { value: 'female', label: t('account.info.female') },
          ]}
          onChange={(sex) => setDraft((d) => ({ ...d, sex }))}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.lab}>{t('account.info.birthdate')}</span>
        <input
          type="date"
          className={styles.select}
          aria-label={t('account.info.birthdate')}
          value={draft.birthdate}
          onChange={(e) => setDraft((d) => ({ ...d, birthdate: e.target.value }))}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.lab}>{t('account.info.height')}</span>
        <NumberInput
          suffix="cm"
          min={0}
          aria-label={t('account.info.height')}
          wrapperClassName={styles.infoNum}
          value={draft.heightCm}
          onChange={(e) => setDraft((d) => ({ ...d, heightCm: e.target.value }))}
        />
      </div>
      <div className={styles.infoActions}>
        <Button variant="ghost" onClick={save} disabled={mutation.isPending}>
          {t('account.info.save')}
        </Button>
      </div>
    </>
  );
}
