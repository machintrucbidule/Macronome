import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Settings } from '@macronome/shared';
import { SettingsSync } from './SettingsSync';
import { settingsApi } from '../api/settings';

// B-022: SettingsSync must NOT probe GET /settings on the public auth pages. Such an
// anonymous request mints its own session at boot (CSRF token side-effect) and can clobber
// the freshly authenticated cookie after setup, forcing one spurious re-login on reload.
// On an authenticated route it must still sync (theme/locale follow the user).
function renderAt(pathname: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pathname]}>
        <SettingsSync>
          <div>child</div>
        </SettingsSync>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsSync (B-022)', () => {
  it('does not fetch settings on the public auth pages', async () => {
    const getSpy = vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: {} as Settings });

    for (const path of ['/setup', '/login']) {
      getSpy.mockClear();
      renderAt(path);
      // Give react-query a chance to (not) fire the disabled query.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getSpy).not.toHaveBeenCalled();
    }
  });

  it('fetches settings on an authenticated route', async () => {
    const getSpy = vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: {} as Settings });

    renderAt('/');

    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
  });
});
