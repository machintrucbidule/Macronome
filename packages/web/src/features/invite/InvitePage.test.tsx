import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { authApi } from '../../api/auth';
import { InvitePage } from './InvitePage';

// B-193: the invitation landing probes the token (read from the URL fragment) and
// either hosts the 3-step wizard or shows the dead-link screen.
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/invite']}>
        <InvitePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  window.location.hash = '#raw-invite-token';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('InvitePage (B-193)', () => {
  it('hosts the wizard for a valid invite token', async () => {
    const probe = vi
      .spyOn(authApi, 'tokenState')
      .mockResolvedValue({ valid: true, kind: 'invite', is_admin: false });
    renderPage();
    await waitFor(() => screen.getByText(i18n.t('invite.title')));
    expect(probe).toHaveBeenCalledWith('raw-invite-token');
    screen.getByLabelText('Identifiant'); // credentials step is up
  });

  it('shows the dead-link screen for an invalid/expired token', async () => {
    vi.spyOn(authApi, 'tokenState').mockResolvedValue({ valid: false });
    renderPage();
    await waitFor(() => screen.getByText(i18n.t('invite.deadTitle')));
    screen.getByText(i18n.t('invite.toLogin'));
    expect(screen.queryByText(i18n.t('invite.title'))).toBeNull();
  });

  it('treats a reset token opened on /invite as a dead link (wrong kind)', async () => {
    vi.spyOn(authApi, 'tokenState').mockResolvedValue({ valid: true, kind: 'password_reset' });
    renderPage();
    await waitFor(() => screen.getByText(i18n.t('invite.deadTitle')));
  });
});
