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
    fireEvent.change(screen.getByLabelText('Sexe'), { target: { value: 'male' } });
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
    fireEvent.change(screen.getByLabelText('Sexe'), { target: { value: 'male' } });
    fireEvent.change(screen.getByLabelText('Date de naissance'), {
      target: { value: '1990-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Taille/), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));

    await waitFor(() => expect(authApi.setup).toHaveBeenCalledTimes(1));
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
});
