import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Advice, Settings } from '@macronome/shared';
import i18n from '../../i18n/config';
import { SESSION_KEY } from '../../app/useSession';
import { SETTINGS_KEY } from '../settings/useSettings';
import { aiApi } from '../../api/ai';
import { ApiError } from '../../api/client';
import { AdvicesPage } from './AdvicesPage';

// B-202 web slice: the Advices page renders the archive + generate control + AiNotConfigured state,
// and shows the generated Markdown reply. The dashboard is pure reuse of already-tested components,
// so it's stubbed here to isolate the advice core (generate / archive / delete / unconfigured / error).
vi.mock('./components/AdviceDashboard', () => ({
  AdviceDashboard: () => <div>dashboard-stub</div>,
}));

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function settings(adviceModel: string | null): Settings {
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
        advice: { model: adviceModel, prompt: 'p' },
      },
    },
  } as unknown as Settings;
}

const advice = (id: string, content: string): Advice => ({
  id,
  created_at: '2026-07-09T12:00:00.000Z',
  model: 'coach-x',
  content,
  snapshot: {},
});

function renderPage(adviceModel: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_KEY, {
    user: { id: 'u1', username: 'ivan', locale: 'fr', theme: 'dark', is_admin: false },
  });
  client.setQueryData(SETTINGS_KEY, { data: settings(adviceModel) });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/advices']}>
        <AdvicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdvicesPage (B-202)', () => {
  it('renders the dashboard, the generate button, and an empty archive', async () => {
    vi.spyOn(aiApi, 'listAdvice').mockResolvedValue({ data: [] });
    renderPage('coach-x');
    expect(await screen.findByText('dashboard-stub')).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('advices.generate') })).toBeTruthy();
    expect(await screen.findByText(i18n.t('advices.empty'))).toBeTruthy();
  });

  it('generate archives a Markdown reply that appears at the top of the archive', async () => {
    const arch: Advice[] = [];
    vi.spyOn(aiApi, 'listAdvice').mockImplementation(() => Promise.resolve({ data: [...arch] }));
    vi.spyOn(aiApi, 'generateAdvice').mockImplementation(() => {
      const a = advice('a1', '## Bilan\n\n- Belle régularité');
      arch.unshift(a);
      return Promise.resolve({ data: a });
    });
    renderPage('coach-x');
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('advices.generate') }));
    // Markdown rendered (heading + list item), not raw text.
    expect(await screen.findByRole('heading', { name: 'Bilan' })).toBeTruthy();
    expect(screen.getByText('Belle régularité')).toBeTruthy();
  });

  it('shows AiNotConfigured (message + link to Assistant IA) when advice has no model', async () => {
    vi.spyOn(aiApi, 'listAdvice').mockResolvedValue({ data: [] });
    renderPage(null);
    // Scope to the AiNotConfigured paragraph — the account menu also has an "Assistant IA" link.
    const notCfg = await screen.findByText(new RegExp(i18n.t('advices.notConfigured')));
    const link = within(notCfg).getByRole('link', { name: i18n.t('advices.configureLink') });
    expect(link.getAttribute('href')).toBe('/ai-assistant');
    expect(screen.queryByRole('button', { name: i18n.t('advices.generate') })).toBeNull();
  });

  it('shows an error banner when generation fails', async () => {
    vi.spyOn(aiApi, 'listAdvice').mockResolvedValue({ data: [] });
    vi.spyOn(aiApi, 'generateAdvice').mockRejectedValue(new ApiError(502, 'ai_bad_response'));
    renderPage('coach-x');
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('advices.generate') }));
    expect(await screen.findByText(i18n.t('advices.errors.ai_bad_response'))).toBeTruthy();
  });
});

describe('AdvicesPage — delete confirm & archive collapse (B-213/B-214)', () => {
  it('confirms before deleting an archived advice (B-213)', async () => {
    const arch: Advice[] = [advice('a1', '## Un conseil')];
    vi.spyOn(aiApi, 'listAdvice').mockImplementation(() => Promise.resolve({ data: [...arch] }));
    vi.spyOn(aiApi, 'deleteAdvice').mockImplementation((id) => {
      const i = arch.findIndex((x) => x.id === id);
      if (i >= 0) arch.splice(i, 1);
      return Promise.resolve();
    });
    renderPage('coach-x');
    // The card renders collapsed; its × is visible. Clicking it asks to confirm — no instant delete.
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('common.remove') }));
    expect(screen.getByText(i18n.t('advices.deletePrompt'))).toBeTruthy();
    // Cancel → nothing deleted, dialog closes.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(aiApi.deleteAdvice).not.toHaveBeenCalled();
    // × again, then the dialog's Delete → the DELETE fires and the archive empties.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.remove') }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('common.remove') }));
    await waitFor(() => expect(aiApi.deleteAdvice).toHaveBeenCalledWith('a1'));
    expect(await screen.findByText(i18n.t('advices.empty'))).toBeTruthy();
  });

  it('renders archive cards collapsed by default; a toggle expands one (B-214)', async () => {
    const arch: Advice[] = [advice('a1', '## Premier'), advice('a2', '## Second')];
    vi.spyOn(aiApi, 'listAdvice').mockResolvedValue({ data: arch });
    renderPage('coach-x');
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: i18n.t('common.remove') })).toHaveLength(2),
    );
    // Both collapsed on a plain load → neither body Markdown is rendered.
    expect(screen.queryByRole('heading', { name: 'Premier' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Second' })).toBeNull();
    // Toggle the first card (the header button carrying aria-expanded) → only it expands.
    const cards = screen.getAllByRole('article');
    fireEvent.click(within(cards[0]!).getByRole('button', { expanded: false }));
    expect(await screen.findByRole('heading', { name: 'Premier' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Second' })).toBeNull();
  });

  it('expands only the just-generated advice, keeping older ones collapsed (B-214)', async () => {
    const arch: Advice[] = [advice('old', '## Ancien')];
    vi.spyOn(aiApi, 'listAdvice').mockImplementation(() => Promise.resolve({ data: [...arch] }));
    vi.spyOn(aiApi, 'generateAdvice').mockImplementation(() => {
      const a = advice('fresh', '## Nouveau');
      arch.unshift(a);
      return Promise.resolve({ data: a });
    });
    renderPage('coach-x');
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: i18n.t('common.remove') })).toHaveLength(1),
    );
    expect(screen.queryByRole('heading', { name: 'Ancien' })).toBeNull(); // collapsed on load
    fireEvent.click(screen.getByRole('button', { name: i18n.t('advices.generate') }));
    // The freshly generated advice shows expanded; the older card stays collapsed.
    expect(await screen.findByRole('heading', { name: 'Nouveau' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ancien' })).toBeNull();
  });

  it('expands then re-collapses via the same toggle (B-214)', async () => {
    const arch: Advice[] = [advice('a1', '## Premier')];
    vi.spyOn(aiApi, 'listAdvice').mockResolvedValue({ data: arch });
    renderPage('coach-x');
    const cards = await screen.findAllByRole('article');
    const toggle = within(cards[0]!).getByRole('button', { expanded: false });
    fireEvent.click(toggle);
    expect(await screen.findByRole('heading', { name: 'Premier' })).toBeTruthy();
    fireEvent.click(within(cards[0]!).getByRole('button', { expanded: true }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Premier' })).toBeNull());
  });
});
