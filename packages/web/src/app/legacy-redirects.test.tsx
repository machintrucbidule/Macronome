import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LEGACY_REDIRECTS, LegacyRedirect } from './legacy-redirects';

// B-240/B-241: the three retired French paths must land on their English replacement instead of
// the not-found screen — bookmarks, the frozen PWA "Paramètres" shortcut and the Google Drive
// OAuth return all still use them. The table is mounted here rather than the whole AppRouter:
// mounting the real router would render every target page (and fire their queries), which would
// test something other than the routing rule.
function Probe() {
  const { pathname, search } = useLocation();
  return <div data-testid="here">{pathname + search}</div>;
}

function landing(entry: string): string {
  const { unmount } = render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {LEGACY_REDIRECTS.map(([from, to]) => (
          <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
        ))}
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = screen.getByTestId('here').textContent ?? '';
  unmount();
  return where;
}

describe('legacy route redirects (B-240)', () => {
  it.each([...LEGACY_REDIRECTS])('sends %s to %s', (from, to) => {
    expect(landing(from)).toBe(to);
  });

  it('carries the query string over (the Google Drive callback marker)', () => {
    expect(landing('/parametres?gdrive=connected')).toBe('/settings?gdrive=connected');
    expect(landing('/parametres?gdrive_error=gdrive_oauth_failed')).toBe(
      '/settings?gdrive_error=gdrive_oauth_failed',
    );
  });

  it('leaves an unrelated unknown path alone (it is the not-found route’s job)', () => {
    expect(landing('/nowhere')).toBe('/nowhere');
  });
});
