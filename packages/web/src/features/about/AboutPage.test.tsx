import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AboutInfo } from '@macronome/shared';
import '../../i18n/config';

// B-310: the Application card shows BOTH versions, always — the one baked into the running
// bundle and the one the server reports — and adds the update mention + link only while they
// actually differ. Before this, the row labelled "Version" was the server's, which is a
// different number in exactly the window right after a deploy.
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  buildVersion: '1.2.3',
}));
vi.mock('../../api/client', () => ({ api: { get: mocks.get } }));
vi.mock('../../lib/build-version', () => ({
  get BUILD_VERSION() {
    return mocks.buildVersion;
  },
  get IS_DEV_BUILD() {
    return mocks.buildVersion === 'dev';
  },
}));
import { AboutPage } from './AboutPage';

const INFO: AboutInfo = {
  app: { name: 'Macronome', version: '1.2.3', environment: 'production' },
  runtime: {
    node_version: 'v22.12.0',
    started_at: '2026-01-01T00:00:00.000Z',
    uptime_s: 60,
    pid: 1,
  },
  system: {
    platform: 'linux',
    os_release: '6.1.0',
    arch: 'x64',
    hostname: 'host',
    cpu_model: 'CPU',
    cpu_cores: 4,
    load_avg: [0, 0, 0],
    mem_total_bytes: 1000,
    mem_free_bytes: 500,
    uptime_s: 120,
  },
  process_memory: { rss_bytes: 10, heap_used_bytes: 5, heap_total_bytes: 8 },
  database: { server_version: 'PostgreSQL 16', size_bytes: 100 },
};

beforeEach(() => {
  // One mocked client for both queries: /about (the snapshot) and /health (the served version).
  mocks.get.mockImplementation((path: string) =>
    path === '/about'
      ? Promise.resolve({ data: INFO })
      : Promise.resolve({ status: 'ok', db: 'up', version: INFO.app.version }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.buildVersion = '1.2.3';
});

function renderPage(servedVersion = '1.2.3') {
  mocks.get.mockImplementation((path: string) =>
    path === '/about'
      ? Promise.resolve({ data: { ...INFO, app: { ...INFO.app, version: servedVersion } } })
      : Promise.resolve({ status: 'ok', db: 'up', version: servedVersion }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AboutPage — Application card versions', () => {
  it('shows both version rows, running and served', async () => {
    mocks.buildVersion = '1.2.3';
    renderPage('1.3.0');
    await waitFor(() => expect(screen.getByText('Version installée')).toBeTruthy());
    expect(screen.getByText('Version du serveur')).toBeTruthy();
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByText('1.3.0')).toBeTruthy();
  });

  it('keeps both rows when the two versions match', async () => {
    mocks.buildVersion = '1.2.3';
    renderPage('1.2.3');
    await waitFor(() => expect(screen.getByText('Version installée')).toBeTruthy());
    expect(screen.getByText('Version du serveur')).toBeTruthy();
  });
});

describe('AboutPage — update mention', () => {
  it('appears with a link to the Paramètres update card when the server is ahead', async () => {
    mocks.buildVersion = '1.2.3';
    renderPage('1.3.0');
    await waitFor(() => expect(screen.getByText('Nouvelle version disponible.')).toBeTruthy());
    const link = screen.getByRole('link', { name: 'Mettre à jour dans Paramètres' });
    expect(link.getAttribute('href')).toBe('/settings#update');
  });

  it('stays absent when the two versions match', async () => {
    mocks.buildVersion = '1.2.3';
    renderPage('1.2.3');
    await waitFor(() => expect(screen.getByText('Version installée')).toBeTruthy());
    expect(screen.queryByText('Nouvelle version disponible.')).toBeNull();
  });

  it('stays absent on an unversioned dev build, even against a numbered server', async () => {
    mocks.buildVersion = 'dev';
    renderPage('1.3.0');
    await waitFor(() => expect(screen.getByText('Version installée')).toBeTruthy());
    expect(screen.queryByText('Nouvelle version disponible.')).toBeNull();
  });
});
