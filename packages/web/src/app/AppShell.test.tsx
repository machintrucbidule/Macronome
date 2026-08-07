import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n/config';
import { AppShell } from './AppShell';
import { NAV_ITEMS } from './nav-items';

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

function renderShell(pathname: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
}

// B-311: Conseils moved off the appbar into the primary nav, last. The desktop nav is the FIRST
// <nav> in the document; the second is the mobile bottom bar, which renders the same list (it is
// `display:none` ≥561px, but jsdom loads no stylesheet, so both are in the tree here).
describe('AppShell — the primary nav carries Conseils last (B-311)', () => {
  it('renders the seven routes in order', () => {
    const { container } = renderShell('/');
    const nav = container.querySelector('nav');
    const links = [...(nav?.querySelectorAll('a') ?? [])];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(NAV_ITEMS.map((i) => i.to));
    expect(links.at(-1)?.textContent).toBe(i18n.t('advices.title'));
  });

  it('lights Conseils on /advices', () => {
    const { container } = renderShell('/advices');
    const nav = container.querySelector('nav');
    const link = [...(nav?.querySelectorAll('a') ?? [])].find(
      (a) => a.getAttribute('href') === '/advices',
    );
    expect(link?.className.trim().length).toBeGreaterThan(0);
  });

  it('no longer reaches Conseils from outside the nav — the lightbulb is gone', () => {
    const { container } = renderShell('/');
    const header = container.querySelector('header');
    // The right cluster still holds the account menu's own links; what it must not hold any more
    // is a second route to /advices, which is what the 💡 icon button was.
    const strays = [...(header?.querySelectorAll('a[href="/advices"]') ?? [])].filter(
      (a) => !a.closest('nav'),
    );
    expect(strays).toHaveLength(0);
  });
});

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
