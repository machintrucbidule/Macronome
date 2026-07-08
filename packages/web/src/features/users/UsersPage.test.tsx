import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AdminUser } from '@macronome/shared';
import i18n from '../../i18n/config';
import { SESSION_KEY } from '../../app/useSession';
import { RequireAdmin } from '../../app/RequireAdmin';
import { USERS_KEY } from './useUsers';
import { UsersPage } from './UsersPage';

// B-192: the Utilisateurs page renders the account rows (roles, « — » for null
// stamps), locks the caller's own row, and gates the delete behind a typed
// confirmation. RequireAdmin bounces non-admins home. Desktop path (no matchMedia).
// Queries are scoped to the tbody where labels collide with column headers
// ("Utilisateur" is both the username column and the standard-role label).
const SELF_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_ID = '00000000-0000-0000-0000-000000000002';

const ROWS: AdminUser[] = [
  {
    id: SELF_ID,
    username: 'ivan',
    is_admin: true,
    created_at: '2026-01-01T10:00:00.000Z',
    last_login_at: '2026-07-01T08:00:00.000Z',
    last_seen_at: '2026-07-08T09:00:00.000Z',
  },
  {
    id: OTHER_ID,
    username: 'ghost',
    is_admin: false,
    created_at: '2026-02-01T10:00:00.000Z',
    last_login_at: null,
    last_seen_at: null,
  },
];

afterEach(cleanup);

function renderPage(isAdmin = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_KEY, {
    user: { id: SELF_ID, username: 'ivan', locale: 'fr', theme: 'dark', is_admin: isAdmin },
  });
  client.setQueryData(USERS_KEY, { data: ROWS });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route
            path="/users"
            element={
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            }
          />
          <Route path="/" element={<div>home-screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function rowsBody(container: HTMLElement) {
  return within(container.querySelector('tbody')!);
}

describe('UsersPage (B-192)', () => {
  it('renders rows with roles, null stamps as — and the self badge', () => {
    const { container } = renderPage();
    const tbody = rowsBody(container);
    tbody.getByText('ivan');
    tbody.getByText('ghost');
    tbody.getByText(i18n.t('users.you'));
    tbody.getByText(i18n.t('account.typeAdmin'));
    tbody.getByText(i18n.t('account.typeUser'));
    expect(tbody.getAllByText('—').length).toBe(2); // ghost's two null stamps
  });

  it('disables the actions on the caller-own row only', () => {
    const { container } = renderPage();
    const deletes = rowsBody(container).getAllByTitle(i18n.t('common.remove'));
    expect(deletes).toHaveLength(2);
    const [selfDel, otherDel] = deletes; // rows sorted by created_at: self first
    expect((selfDel as HTMLButtonElement).disabled).toBe(true);
    expect((otherDel as HTMLButtonElement).disabled).toBe(false);
  });

  it('gates the delete behind retyping the username', () => {
    const { container } = renderPage();
    const otherDel = rowsBody(container)
      .getAllByTitle(i18n.t('common.remove'))
      .find((b) => !(b as HTMLButtonElement).disabled)!;
    fireEvent.click(otherDel);

    screen.getByText(i18n.t('users.deleteConfirm.title'));
    const confirm = screen
      .getAllByRole('button', { name: i18n.t('common.remove') })
      .find((b) => b.textContent === i18n.t('common.remove')) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'wrong' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'ghost' } });
    expect(confirm.disabled).toBe(false);
  });

  it('RequireAdmin silently redirects a non-admin home', () => {
    renderPage(false);
    screen.getByText('home-screen');
    expect(screen.queryByText(i18n.t('users.lead'))).toBeNull();
  });
});
