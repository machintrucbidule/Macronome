import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '../../i18n/config';
import { authApi } from '../../api/auth';
import { ResetPage } from './ResetPage';

// B-194: the set-new-password screen — probe, client validation (8+ chars, match),
// then POST /auth/reset-password and land on /login with the success state.
function LoginStub() {
  const { state } = useLocation();
  return <div>login-stub {(state as { resetDone?: boolean } | null)?.resetDone ? 'ok' : ''}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reset']}>
      <Routes>
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  window.location.hash = '#raw-reset-token';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('ResetPage (B-194)', () => {
  it('validates the new password (length + match) before enabling the submit', async () => {
    vi.spyOn(authApi, 'tokenState').mockResolvedValue({ valid: true, kind: 'password_reset' });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: i18n.t('reset.title') }));

    const submit = screen.getByRole<HTMLButtonElement>('button', {
      name: i18n.t('reset.submit'),
    });
    const pw = screen.getByLabelText(i18n.t('reset.newPassword'));
    const confirm = screen.getByLabelText(i18n.t('reset.confirmPassword'));

    fireEvent.change(pw, { target: { value: 'short' } });
    fireEvent.change(confirm, { target: { value: 'short' } });
    expect(submit.disabled).toBe(true); // under 8 chars
    fireEvent.change(pw, { target: { value: 'long-enough' } });
    expect(submit.disabled).toBe(true); // mismatch
    fireEvent.change(confirm, { target: { value: 'long-enough' } });
    expect(submit.disabled).toBe(false);
  });

  it('submits and lands on /login with the success state', async () => {
    vi.spyOn(authApi, 'tokenState').mockResolvedValue({ valid: true, kind: 'password_reset' });
    const resetSpy = vi.spyOn(authApi, 'resetPassword').mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: i18n.t('reset.title') }));

    fireEvent.change(screen.getByLabelText(i18n.t('reset.newPassword')), {
      target: { value: 'brand-new-pass' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('reset.confirmPassword')), {
      target: { value: 'brand-new-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('reset.submit') }));

    await waitFor(() =>
      expect(resetSpy).toHaveBeenCalledWith({
        token: 'raw-reset-token',
        new_password: 'brand-new-pass',
      }),
    );
    await waitFor(() => screen.getByText('login-stub ok'));
  });

  it('shows the dead-link screen for an invalid token', async () => {
    vi.spyOn(authApi, 'tokenState').mockResolvedValue({ valid: false });
    renderPage();
    await waitFor(() => screen.getByText(i18n.t('reset.deadTitle')));
  });
});
