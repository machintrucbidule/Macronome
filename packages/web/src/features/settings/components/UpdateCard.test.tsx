import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../../i18n/config';
import { consumePendingToast } from '../../../components/Toast/toast-store';

// PWA-1 + B-285/B-286: the card shows the version of the bundle you are RUNNING, flags a newer
// one on the server, and its button always reloads — after activating a waiting worker when
// there is one. The previous version of this file mocked forceUpdate wholesale and asserted
// nothing about the click, which is how a dead button shipped.
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  canInstall: false,
  promptInstall: vi.fn(),
  buildVersion: '1.2.3',
  checkForUpdate: vi.fn(),
  activateUpdate: vi.fn(),
  reloadPage: vi.fn(),
  /** What the flash toast held at the moment activateUpdate ran (ordering guard). */
  toastAtActivation: null as string | null,
}));
vi.mock('../../../api/client', () => ({ api: { get: mocks.get } }));
vi.mock('../../../lib/build-version', () => ({
  get BUILD_VERSION() {
    return mocks.buildVersion;
  },
  get IS_DEV_BUILD() {
    return mocks.buildVersion === 'dev';
  },
}));
vi.mock('../../../lib/reload', () => ({ reloadPage: mocks.reloadPage }));
vi.mock('../../../lib/pwa/registerSw', () => ({
  checkForUpdate: mocks.checkForUpdate,
  activateUpdate: mocks.activateUpdate,
}));
vi.mock('../../../lib/pwa/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ canInstall: mocks.canInstall, promptInstall: mocks.promptInstall }),
}));
import { UpdateCard } from './UpdateCard';

beforeEach(() => {
  mocks.checkForUpdate.mockResolvedValue('current');
  mocks.activateUpdate.mockImplementation(() => {
    mocks.toastAtActivation = consumePendingToast();
    return Promise.resolve();
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.canInstall = false;
  mocks.buildVersion = '1.2.3';
  mocks.toastAtActivation = null;
});

function renderCard(servedVersion = '1.2.3') {
  mocks.get.mockResolvedValue({ status: 'ok', db: 'up', version: servedVersion });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UpdateCard />
    </QueryClientProvider>,
  );
}

const clickUpdate = () => fireEvent.click(screen.getByText('Mettre à jour'));

describe('UpdateCard version line', () => {
  it('shows the version of the bundle currently running', async () => {
    renderCard();
    expect(await screen.findByText('Version 1.2.3')).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledWith('/health');
  });

  it('flags the served version when it differs from the running one', async () => {
    renderCard('1.3.0');
    expect(await screen.findByText('Version 1.2.3 → 1.3.0')).toBeTruthy();
    expect(screen.getByText('Nouvelle version disponible')).toBeTruthy();
  });

  it('says nothing about an update when both versions match', async () => {
    renderCard();
    await screen.findByText('Version 1.2.3');
    expect(screen.queryByText('Nouvelle version disponible')).toBeNull();
  });

  it('never claims to be stale on an unversioned dev build', async () => {
    mocks.buildVersion = 'dev';
    renderCard('1.3.0');
    expect(await screen.findByText('Version dev')).toBeTruthy();
    expect(screen.queryByText('Nouvelle version disponible')).toBeNull();
  });
});

describe('UpdateCard force update', () => {
  it('activates the waiting worker, then reloads, having stored the confirmation first', async () => {
    mocks.checkForUpdate.mockResolvedValue('update-ready');
    renderCard();
    await screen.findByText('Version 1.2.3');

    clickUpdate();

    await waitFor(() => expect(mocks.reloadPage).toHaveBeenCalledTimes(1));
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.activateUpdate).toHaveBeenCalledTimes(1);
    // Stored BEFORE activation: the plugin can reload the document as soon as the new worker
    // takes control, so a toast raised after would vanish with it.
    expect(mocks.toastAtActivation).toBe('Mise à jour appliquée');
  });

  it('still reloads when there is nothing new, and says so', async () => {
    renderCard();
    await screen.findByText('Version 1.2.3');

    clickUpdate();

    await waitFor(() => expect(mocks.reloadPage).toHaveBeenCalledTimes(1));
    expect(mocks.activateUpdate).not.toHaveBeenCalled();
    expect(consumePendingToast()).toBe('Déjà à jour');
  });

  it('disables the button while the check runs', async () => {
    let release = (): void => {};
    mocks.checkForUpdate.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve('current');
      }),
    );
    renderCard();
    await screen.findByText('Version 1.2.3');

    clickUpdate();

    const pending = await screen.findByText('Mise à jour…');
    expect(pending.closest('button')?.disabled).toBe(true);
    expect(mocks.reloadPage).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(mocks.reloadPage).toHaveBeenCalledTimes(1));
  });
});

describe('UpdateCard install button', () => {
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
