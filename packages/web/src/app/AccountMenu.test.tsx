import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n/config';
import { SESSION_KEY } from './useSession';
import { AccountMenu } from './AccountMenu';

// B-243: the seven destinations are grouped into three titled blocks (COMPTE / MES DONNÉES /
// CONFIGURATION) then the meta block, in both variants. B-192 still applies per item:
// "Utilisateurs" is admin-only — and a group emptied by that filter must not render its heading
// (here COMPTE keeps "Mon compte", so its heading stays).
// jsdom has no matchMedia → the desktop dropdown renders unless mobile is forced (below).
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

const HEADINGS = ['menu.group.account', 'menu.group.data', 'menu.group.config'].map((k) =>
  i18n.t(k),
);

// The block headings are real <h3>s (the Modal's own title is a <span>, so the sheet's headings
// are the only headings there either); CSS modules are not applied under vitest, so the markup —
// not a class name — is what the test keys on.
function menuOrder(root: HTMLElement): string[] {
  return [...root.querySelectorAll('a, h3')].map((el) => el.textContent ?? '');
}

function linkTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll('a')].map((a) => a.textContent ?? '');
}

describe('AccountMenu — titled blocks (B-243)', () => {
  it('renders the three headings in order, each above its own items', () => {
    const { container, unmount } = renderMenu(true);
    const order = menuOrder(container);

    expect(order.filter((t) => HEADINGS.includes(t))).toEqual(HEADINGS);
    // COMPTE: Mon compte then Utilisateurs; MES DONNÉES: Cibles then Contenants;
    // CONFIGURATION: Paramètres, Assistant IA, Intégrations; then the meta block.
    expect(order).toEqual([
      HEADINGS[0],
      i18n.t('menu.account'),
      i18n.t('users.title'),
      HEADINGS[1],
      i18n.t('targets.title'),
      i18n.t('containers.title'),
      HEADINGS[2],
      i18n.t('settings.title'),
      i18n.t('settings.ai.title'),
      i18n.t('integrations.title'),
      i18n.t('menu.about'),
    ]);
    unmount();
  });

  it('hides Utilisateurs for a standard user but keeps its heading (Mon compte remains)', () => {
    const { container, unmount } = renderMenu(false);
    const texts = linkTexts(container);

    expect(texts).not.toContain(i18n.t('users.title'));
    expect(menuOrder(container).filter((t) => HEADINGS.includes(t))).toEqual(HEADINGS);
    expect(texts).toContain(i18n.t('menu.account'));
    expect(texts).toContain(i18n.t('settings.title'));
    expect(texts).toContain(i18n.t('menu.about'));
    unmount();
  });

  it('shows the same structure in the mobile sheet', () => {
    const query = { matches: true, addEventListener: () => {}, removeEventListener: () => {} };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => query,
    });
    try {
      const { unmount } = renderMenu(true);
      fireEvent.click(screen.getByTitle('ivan')); // open the sheet
      // The sheet is a Modal portalled to <body>, so query the document, not the container.
      expect(menuOrder(document.body).filter((t) => HEADINGS.includes(t))).toEqual(HEADINGS);
      expect(linkTexts(document.body)).toContain(i18n.t('targets.title'));
      unmount();
    } finally {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
