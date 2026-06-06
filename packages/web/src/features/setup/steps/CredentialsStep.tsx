import { useTranslation } from 'react-i18next';
import { TextInput } from '../../../components/Form/TextInput';
import type { SetupDraft } from '../useSetup';

// Step 1 of the first-run wizard: the owner's credentials. Presentational — validation
// and submission live in useSetup.
interface Props {
  draft: SetupDraft;
  set: (patch: Partial<SetupDraft>) => void;
}

export function CredentialsStep({ draft, set }: Props) {
  const { t } = useTranslation();
  const mismatch = draft.confirmPassword.length > 0 && draft.confirmPassword !== draft.password;
  return (
    <>
      <TextInput
        label={t('setup.username')}
        autoComplete="username"
        value={draft.username}
        onChange={(e) => set({ username: e.target.value })}
      />
      <TextInput
        label={t('setup.password')}
        type="password"
        autoComplete="new-password"
        value={draft.password}
        onChange={(e) => set({ password: e.target.value })}
      />
      <p>{t('setup.passwordHint')}</p>
      <TextInput
        label={t('setup.confirmPassword')}
        type="password"
        autoComplete="new-password"
        invalid={mismatch}
        value={draft.confirmPassword}
        onChange={(e) => set({ confirmPassword: e.target.value })}
      />
      {mismatch && <p role="alert">{t('setup.passwordMismatch')}</p>}
    </>
  );
}
