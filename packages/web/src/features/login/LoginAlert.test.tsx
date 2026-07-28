import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../i18n/config';
import { StateAlert } from './LoginAlert';
import type { LoginFailure } from './useLogin';

// The login error banner (states.md §Login, B-231): the copy must name the cause, and the diagnostic
// code appears only for technical failures.
const REF = 'K7QM-3ZP2';

function renderAlert(failure: LoginFailure) {
  return render(<StateAlert state="error" failure={failure} lockSeconds={0} />);
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StateAlert copy per failure kind', () => {
  it('bad credentials: the generic non-enumerating copy, and NO diagnostic code', () => {
    renderAlert({ kind: 'credentials' });
    expect(screen.getByRole('alert').textContent).toContain('Identifiant ou mot de passe');
    expect(screen.queryByText('Code de diagnostic')).toBeNull();
  });

  // The message that must not read as a wrong password: it names what to check.
  it('session refused: names the server settings to check, and shows the code', () => {
    renderAlert({ kind: 'session', ref: REF });
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('session');
    expect(text).toContain('COOKIE_SECURE');
    expect(text).toContain('TRUSTED_PROXY');
    expect(screen.getByText(REF)).toBeTruthy();
  });

  it('database unavailable: says to wait and that nothing needs changing', () => {
    renderAlert({ kind: 'database', ref: REF });
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('base de données');
    expect(text).toContain('rien à modifier');
    expect(screen.getByText(REF)).toBeTruthy();
  });

  it('application error: points at the code', () => {
    renderAlert({ kind: 'application', ref: REF });
    expect(screen.getByRole('alert').textContent).toContain('erreur interne');
    expect(screen.getByText(REF)).toBeTruthy();
  });

  // No record could have been written, so there is deliberately nothing to quote.
  it('unreachable: covers "still starting" and shows no code', () => {
    renderAlert({ kind: 'unreachable' });
    expect(screen.getByRole('alert').textContent).toContain('démarrage');
    expect(screen.queryByText('Code de diagnostic')).toBeNull();
  });

  it('renders the English copy too', async () => {
    await i18n.changeLanguage('en');
    renderAlert({ kind: 'database', ref: REF });
    expect(screen.getByRole('alert').textContent).toContain('database is temporarily unavailable');
    await i18n.changeLanguage('fr');
  });
});

describe('diagnostic code chip', () => {
  // It renders inside the login <form>: a default-type button would re-submit the login.
  it('the copy control is type="button", not a submit', () => {
    renderAlert({ kind: 'session', ref: REF });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copier' }).type).toBe('button');
  });

  it('copies the code and confirms', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderAlert({ kind: 'session', ref: REF });

    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));

    expect(writeText).toHaveBeenCalledWith(REF);
  });

  // A self-hosted instance reached over plain HTTP is not a secure context, so there is no clipboard
  // API there — exactly the deployment most likely to hit this error. The code must stay readable.
  it('does not throw without a clipboard API, and the code stays selectable', () => {
    vi.stubGlobal('navigator', {});
    renderAlert({ kind: 'application', ref: REF });

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Copier' }))).not.toThrow();
    expect(screen.getByText(REF)).toBeTruthy();
  });
});
