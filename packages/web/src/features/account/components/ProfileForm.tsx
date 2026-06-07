import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile, Sex } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { Button } from '../../../components/Button/Button';
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
    <div className={styles.infoForm}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('account.info.sex')}</span>
        <select
          className={styles.select}
          value={draft.sex}
          onChange={(e) => setDraft((d) => ({ ...d, sex: e.target.value as Sex }))}
        >
          <option value="male">{t('account.info.male')}</option>
          <option value="female">{t('account.info.female')}</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('account.info.birthdate')}</span>
        <input
          type="date"
          className={styles.select}
          value={draft.birthdate}
          onChange={(e) => setDraft((d) => ({ ...d, birthdate: e.target.value }))}
        />
      </label>
      <NumberInput
        label={t('account.info.height')}
        suffix="cm"
        min={0}
        value={draft.heightCm}
        onChange={(e) => setDraft((d) => ({ ...d, heightCm: e.target.value }))}
      />
      <Button variant="ghost" onClick={save} disabled={mutation.isPending}>
        {t('account.info.save')}
      </Button>
    </div>
  );
}
