import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Settings } from '@macronome/shared';
import i18n from '../../../i18n/config';

// B-216: the Assistant IA card exposes an "allergies / disliked foods" field under the task blocks
// and saves it as ai.avoidances in the settings PATCH. The settings API client is mocked.
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), fetchAiModels: vi.fn() }));
vi.mock('../../../api/settings', () => ({ settingsApi: mocks }));
import { AiCard } from './AiCard';

function settings(avoidances: string): Settings {
  return {
    locale: 'fr',
    theme: 'dark',
    integrations: { home_assistant: null, barclaude_gateway: null },
    current_mode: null,
    open_period_note: null,
    lines_desktop: 20,
    lines_mobile: 15,
    ai: {
      provider: 'openai_compatible',
      base_url: 'https://x',
      api_key_set: true,
      tasks: {
        dish_photo_macros: { model: null, prompt: 'p' },
        meal_suggestions: { model: null, prompt: 'p' },
        advice: { model: 'coach-x', prompt: 'p' },
      },
      avoidances,
    },
  } as unknown as Settings;
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.clearAllMocks();
});

function renderCard(avoidances: string) {
  mocks.get.mockResolvedValue({ data: settings(avoidances) });
  mocks.patch.mockImplementation((body) => Promise.resolve({ data: { ...settings(''), ...body } }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AiCard />
    </QueryClientProvider>,
  );
}

describe('AiCard — allergies / disliked foods (B-216)', () => {
  it('renders the avoidances field seeded from the stored config', async () => {
    renderCard('peanuts, shellfish');
    const field = await screen.findByRole('textbox', { name: i18n.t('settings.ai.avoidances') });
    // Wait for the async settings load to seed the draft (the field exists empty before then).
    await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe('peanuts, shellfish'));
  });

  it('saves the edited avoidances in the settings PATCH', async () => {
    renderCard('');
    // Wait for the stored config to load first (base_url seeded), so typing isn't overwritten.
    await screen.findByDisplayValue('https://x');
    const field = await screen.findByRole('textbox', { name: i18n.t('settings.ai.avoidances') });
    fireEvent.change(field, { target: { value: 'peanuts' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('settings.ai.save') }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        expect.objectContaining({ ai: expect.objectContaining({ avoidances: 'peanuts' }) }),
      ),
    );
  });
});
