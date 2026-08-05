import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { SetupWizard } from './SetupWizard';
import { authApi } from '../../api/auth';
import { targetApi } from '../../api/target';

// B-059: the first-run wizard gained a 3rd "Mes cibles" step. It pre-fills sensible defaults and,
// once the owner account is created, persists the initial targets via POST /target.
function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/setup']}>
        <SetupWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// FORM-1: the sex picker is SelectMenu in its field variant (trigger button + listbox), not a
// native <select> — so it is driven by two clicks rather than a change event.
function pickSex(field: string, option: string): void {
  fireEvent.click(screen.getByRole('button', { name: field }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SetupWizard targets step (B-059)', () => {
  it('reaches the targets step with the defaults pre-filled and guidance presets', () => {
    renderWizard();
    // Step 1 → 2 → 3.
    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'owner' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'correct-horse' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'correct-horse' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    pickSex('Sexe', 'Homme');
    fireEvent.change(screen.getByLabelText('Date de naissance'), {
      target: { value: '1990-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Taille/), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByLabelText<HTMLInputElement>(/Calories min/).value).toBe('1950');
    expect(screen.getByLabelText<HTMLInputElement>(/Calories max/).value).toBe('2050');
    expect(screen.getByLabelText<HTMLInputElement>(/Protéines/).value).toBe('1.8');
    expect(screen.getByLabelText<HTMLInputElement>(/Lipides/).value).toBe('0.8');
    // Guidance presets are present (reused from Cibles).
    expect(screen.getByText(/Sédentaire/)).toBeTruthy();
  });

  it('creates the account then persists the initial targets via POST /target', async () => {
    vi.spyOn(authApi, 'setup').mockResolvedValue({
      user: { id: '1', username: 'owner', locale: 'fr', theme: 'dark' },
    } as never);
    const createSpy = vi.spyOn(targetApi, 'create').mockResolvedValue({} as never);

    renderWizard();
    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'owner' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'correct-horse' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'correct-horse' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    pickSex('Sexe', 'Homme');
    fireEvent.change(screen.getByLabelText('Date de naissance'), {
      target: { value: '1990-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Taille/), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));

    await waitFor(() => expect(authApi.setup).toHaveBeenCalledTimes(1));
    // B-237: the payload carries the pre-auth language/theme so the account starts on that choice.
    expect(vi.mocked(authApi.setup).mock.calls[0]![0]).toMatchObject({
      locale: 'fr',
      theme: 'dark',
    });
    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          calorie_min: 1950,
          calorie_max: 2050,
          protein_g_per_kg: 1.8,
          fat_g_per_kg: 0.8,
          target_weight_kg: null,
          rate_kg_per_week: null,
        }),
      ),
    );
  });

  // B-237: picking EN on the pre-auth bar used to die with the wizard — the account was created
  // with the fr default and the settings sync put French back on first entry.
  it('sends the language chosen before submitting (B-237)', async () => {
    vi.spyOn(authApi, 'setup').mockResolvedValue({
      user: { id: '1', username: 'owner', locale: 'en', theme: 'dark' },
    } as never);
    vi.spyOn(targetApi, 'create').mockResolvedValue({} as never);
    await i18n.changeLanguage('en');

    renderWizard();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'owner' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'correct-horse' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    pickSex('Sex', 'Male');
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText(/Height/), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(authApi.setup).toHaveBeenCalledTimes(1));
    expect(vi.mocked(authApi.setup).mock.calls[0]![0]).toMatchObject({ locale: 'en' });
  });
});
