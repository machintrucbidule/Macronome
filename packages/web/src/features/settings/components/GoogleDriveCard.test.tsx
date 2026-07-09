import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { GoogleDriveRead, Settings } from '@macronome/shared';
import i18n from '../../../i18n/config';

// GoogleDriveCard (B-208): the settings-page Google Drive backup card. Mocks the settings +
// google-drive api clients; asserts the OAuth Connect flow, backup-now / disconnect actions,
// the config PATCH, the callback flash banner, and that the guide + cleartext note render.
const mocks = vi.hoisted(() => ({
  settings: { get: vi.fn(), patch: vi.fn(), fetchAiModels: vi.fn() },
  gdrive: { connect: vi.fn(), disconnect: vi.fn(), backupNow: vi.fn() },
}));
vi.mock('../../../api/settings', () => ({ settingsApi: mocks.settings }));
vi.mock('../../../api/integrations', () => ({ googleDriveApi: mocks.gdrive }));
import { GoogleDriveCard } from './GoogleDriveCard';

// window.location.assign is used by Connect; stub it (+ origin for the callback URL in the guide).
Object.defineProperty(window, 'location', {
  configurable: true,
  value: { origin: 'https://app.example.com', assign: vi.fn() },
});

function gdRead(over: Partial<GoogleDriveRead> = {}): GoogleDriveRead {
  return {
    client_id: '',
    client_secret_set: false,
    refresh_token_set: false,
    folder_id: null,
    enabled: false,
    retention_days: 7,
    time_of_day: '03:00',
    last_backup_at: null,
    last_status: null,
    last_error: null,
    ...over,
  };
}

function settings(gd: GoogleDriveRead | null): Settings {
  return {
    locale: 'fr',
    theme: 'dark',
    ai: null,
    integrations: { home_assistant: null, barclaude_gateway: null, google_drive: gd },
    current_mode: null,
    open_period_note: null,
    lines_desktop: 20,
    lines_mobile: 15,
  } as unknown as Settings;
}

function renderCard(gd: GoogleDriveRead | null, entry = '/parametres') {
  mocks.settings.get.mockResolvedValue({ data: settings(gd) });
  mocks.settings.patch.mockImplementation((body: object) =>
    Promise.resolve({ data: { ...settings(gd), ...body } }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <GoogleDriveCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const connectBtn = () => screen.getByRole('button', { name: i18n.t('settings.gdrive.connect') });

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.clearAllMocks();
});

describe('GoogleDriveCard (B-208)', () => {
  it('shows the setup guide and the always-visible cleartext note', async () => {
    renderCard(null);
    expect(await screen.findByText(i18n.t('settings.gdrive.help.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('settings.gdrive.cleartextNote'))).toBeTruthy();
  });

  it('disables Connect until the client creds are configured', async () => {
    renderCard(null);
    await waitFor(() => expect((connectBtn() as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByText(i18n.t('settings.gdrive.notConnected'))).toBeTruthy();
  });

  it('configured + not connected → Connect starts the OAuth flow', async () => {
    mocks.gdrive.connect.mockResolvedValue({
      data: { auth_url: 'https://accounts.google.com/o/x' },
    });
    renderCard(gdRead({ client_id: 'cid', client_secret_set: true }));
    await waitFor(() => expect((connectBtn() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(connectBtn());
    await waitFor(() => expect(mocks.gdrive.connect).toHaveBeenCalled());
  });

  it('connected → Back up now and Disconnect call the api', async () => {
    mocks.gdrive.backupNow.mockResolvedValue({
      data: { last_backup_at: '2026-01-15T02:00:00Z', last_status: 'ok', last_error: null },
    });
    mocks.gdrive.disconnect.mockResolvedValue({ data: { connected: false } });
    renderCard(
      gdRead({
        client_id: 'cid',
        client_secret_set: true,
        refresh_token_set: true,
        folder_id: 'F1',
      }),
    );

    const backup = await screen.findByRole('button', { name: i18n.t('settings.gdrive.backupNow') });
    fireEvent.click(backup);
    await waitFor(() => expect(mocks.gdrive.backupNow).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: i18n.t('settings.gdrive.disconnect') }));
    await waitFor(() => expect(mocks.gdrive.disconnect).toHaveBeenCalled());
  });

  it('Save persists the config via the settings PATCH (integrations.google_drive)', async () => {
    renderCard(gdRead({ client_id: 'seed', client_secret_set: true }));
    // Wait for the stored config to seed the draft first, so the change isn't overwritten.
    const clientId = await screen.findByDisplayValue('seed');
    fireEvent.change(clientId, { target: { value: 'new-client' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('settings.gdrive.save') }));
    await waitFor(() =>
      expect(mocks.settings.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: { google_drive: expect.objectContaining({ client_id: 'new-client' }) },
        }),
      ),
    );
  });

  it('surfaces the OAuth callback success marker as a banner', async () => {
    renderCard(
      gdRead({ client_id: 'cid', client_secret_set: true }),
      '/parametres?gdrive=connected',
    );
    expect(await screen.findByText(i18n.t('settings.gdrive.connectedOk'))).toBeTruthy();
  });
});
