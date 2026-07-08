import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { SESSION_KEY } from '../../app/useSession';
import { AccountPage } from './AccountPage';

// B-191: the Identifiants card shows the account type read from the session role,
// and the account entry/page is renamed "Mon compte".
function renderWithSession(isAdmin: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_KEY, {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'ivan',
      locale: 'fr',
      theme: 'dark',
      is_admin: isAdmin,
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountPage — account type (B-191)', () => {
  it('shows Administrateur for an admin session', () => {
    const { getByText, unmount } = renderWithSession(true);
    getByText(i18n.t('account.accountType'));
    getByText(i18n.t('account.typeAdmin'));
    unmount();
  });

  it('shows Utilisateur for a standard session', () => {
    const { getByText, queryByText, unmount } = renderWithSession(false);
    getByText(i18n.t('account.typeUser'));
    expect(queryByText(i18n.t('account.typeAdmin'))).toBeNull();
    unmount();
  });

  it('menu entry and page title carry the "Mon compte" rename in both locales', () => {
    expect(i18n.getResource('fr', 'translation', 'menu.account')).toBe('Mon compte');
    expect(i18n.getResource('fr', 'translation', 'account.title')).toBe('Mon compte');
    expect(i18n.getResource('en', 'translation', 'menu.account')).toBe('My account');
    expect(i18n.getResource('en', 'translation', 'account.title')).toBe('My account');
  });
});
