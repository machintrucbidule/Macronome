import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n/config';
import { AppShell } from './AppShell';

// B-014: Repas is reachable as both `/` and `/day/:date`. Its primary-nav tab must stay
// lit on either route; previously `NavLink to="/" end` dropped the highlight on day change.
// Since B-274 the shell is a layout route, so it is mounted as one here (the page renders into
// its <Outlet/>) rather than taking children.
function repasClassAt(pathname: string): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container, unmount } = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const label = i18n.t('meals.title');
  const link = [...container.querySelectorAll('nav a')].find((a) => a.textContent === label);
  if (!link) throw new Error('Repas nav link not found');
  const cls = link.className;
  unmount();
  return cls;
}

describe('AppShell — Repas active route (B-014)', () => {
  it('keeps Repas active on /day/:date (same active class as the home route)', () => {
    const home = repasClassAt('/');
    const day = repasClassAt('/day/2026-06-06');
    const foods = repasClassAt('/foods');
    // Home and a specific day share the lit state; another screen does not.
    expect(day).toBe(home);
    expect(home).not.toBe(foods);
    // The active state must apply an actual class (guards against a no-op fix).
    expect(home.trim().length).toBeGreaterThan(0);
    expect(foods.trim().length).toBe(0);
  });
});
