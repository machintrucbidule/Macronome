import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile, Sex } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { Button } from '../../../components/Button/Button';
import { useProfileMutation } from '../useTargets';
import styles from '../cibles.module.css';

// Metabolic profile (sex / birth date / height) — the Cibles screen is its home. Edits
// PATCH /profile and invalidate the engine readout (age is derived server-side).
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
    <div className={styles.profileForm}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('cibles.profile.sex')}</span>
        <select
          className={styles.select}
          value={draft.sex}
          onChange={(e) => setDraft((d) => ({ ...d, sex: e.target.value as Sex }))}
        >
          <option value="male">{t('cibles.profile.male')}</option>
          <option value="female">{t('cibles.profile.female')}</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('cibles.profile.birthdate')}</span>
        <input
          type="date"
          className={styles.select}
          value={draft.birthdate}
          onChange={(e) => setDraft((d) => ({ ...d, birthdate: e.target.value }))}
        />
      </label>
      <NumberInput
        label={t('cibles.profile.height')}
        suffix="cm"
        min={0}
        value={draft.heightCm}
        onChange={(e) => setDraft((d) => ({ ...d, heightCm: e.target.value }))}
      />
      <Button variant="ghost" onClick={save} disabled={mutation.isPending}>
        {t('cibles.profile.save')}
      </Button>
    </div>
  );
}
