import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n/config';
import { SESSION_KEY } from './useSession';
import { AccountMenu } from './AccountMenu';

// B-192: the "Utilisateurs" entry is admin-conditional — present between
// Intégrations and Paramètres for an admin session, absent for a standard one.
// jsdom has no matchMedia → the desktop dropdown renders.
function renderMenu(isAdmin: boolean) {
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
        <AccountMenu />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function linkTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('a')].map((a) => a.textContent ?? '');
}

describe('AccountMenu — admin-conditional Utilisateurs entry (B-192)', () => {
  it('shows Utilisateurs between Intégrations and Paramètres for an admin', () => {
    const { container, unmount } = renderMenu(true);
    const texts = linkTexts(container);
    const users = texts.indexOf(i18n.t('users.title'));
    expect(users).toBeGreaterThan(-1);
    expect(texts[users - 1]).toBe(i18n.t('integrations.title'));
    expect(texts[users + 1]).toBe(i18n.t('settings.title'));
    unmount();
  });

  it('hides Utilisateurs for a standard user, keeping the rest of the menu', () => {
    const { container, unmount } = renderMenu(false);
    const texts = linkTexts(container);
    expect(texts).not.toContain(i18n.t('users.title'));
    expect(texts).toContain(i18n.t('integrations.title'));
    expect(texts).toContain(i18n.t('settings.title'));
    expect(texts).toContain(i18n.t('menu.about'));
    unmount();
  });
});
