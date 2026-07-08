import { Trans, useTranslation } from 'react-i18next';
import type { AdminUser } from '@macronome/shared';
import { ConfirmTyped } from '../../../components/Modal/ConfirmTyped';

// Strong confirmation for the irreversible account delete (screens/users.md): the
// admin must retype the target's username (user data — not a localized word).
interface Props {
  user: AdminUser;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteUserConfirm({ user, pending, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <ConfirmTyped
      title={t('users.deleteConfirm.title')}
      word={user.username}
      confirmLabel={t('common.remove')}
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <Trans
        i18nKey="users.deleteConfirm.body"
        values={{ name: user.username }}
        components={{ b: <b /> }}
      />
    </ConfirmTyped>
  );
}
