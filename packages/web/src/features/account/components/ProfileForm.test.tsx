import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Profile } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { ProfileForm } from './ProfileForm';
import { profileApi } from '../../../api/profile';

// B-060: the metabolic profile (sex / birth date / height) is edited on the Compte screen now.
// The form renders the current values and saves via PATCH /profile.
const PROFILE: Profile = { sex: 'male', birthdate: '1990-01-01', height_cm: 180 };

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProfileForm profile={PROFILE} />
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

describe('account ProfileForm (B-060)', () => {
  it('renders the profile fields seeded from the current profile', () => {
    renderForm();
    expect(screen.getByLabelText<HTMLSelectElement>('Sexe').value).toBe('male');
    expect(screen.getByLabelText<HTMLInputElement>('Date de naissance').value).toBe('1990-01-01');
    expect(screen.getByLabelText<HTMLInputElement>(/Taille/).value).toBe('180');
  });

  it('saves the edited profile via PATCH /profile', async () => {
    const patchSpy = vi.spyOn(profileApi, 'patch').mockResolvedValue({ data: PROFILE });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Taille/), { target: { value: '175' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour le profil' }));
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith({
        sex: 'male',
        birthdate: '1990-01-01',
        height_cm: 175,
      }),
    );
  });
});
