import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../../i18n/config';

// PWA-1: the update card shows the version read from /health and offers install only when the
// browser does. The /health client and the install/update hooks are mocked.
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  canInstall: false,
  promptInstall: vi.fn(),
}));
vi.mock('../../../api/client', () => ({ api: { get: mocks.get } }));
vi.mock('../../../lib/pwa/registerSw', () => ({ forceUpdate: vi.fn() }));
vi.mock('../../../lib/pwa/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ canInstall: mocks.canInstall, promptInstall: mocks.promptInstall }),
}));
import { UpdateCard } from './UpdateCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.canInstall = false;
});

function renderCard() {
  mocks.get.mockResolvedValue({ status: 'ok', db: 'up', version: '1.2.3' });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UpdateCard />
    </QueryClientProvider>,
  );
}

describe('UpdateCard', () => {
  it('shows the running version read from /health', async () => {
    renderCard();
    expect(await screen.findByText('Version 1.2.3')).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledWith('/health');
  });

  it('hides the install button when the browser does not offer installation', async () => {
    renderCard();
    await screen.findByText('Version 1.2.3');
    expect(screen.queryByText('Installer')).toBeNull();
  });

  it('shows the install button when installation is available', async () => {
    mocks.canInstall = true;
    renderCard();
    expect(await screen.findByText('Installer')).toBeTruthy();
  });
});
