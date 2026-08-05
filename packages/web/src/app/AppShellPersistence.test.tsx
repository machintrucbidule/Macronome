import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';

// B-274: the app chrome is a layout route, so it is mounted once and survives every in-app
// navigation. Before, each page mounted its own AppShell: the appbar, the bottom nav and the
// animated brand tick were rebuilt on every page change, which is why the tick's swing snapped
// back to its start angle. Asserting **node identity** is the point — a re-render is fine, a
// remount is the bug.
afterEach(cleanup);

describe('AppShell persistence (B-274)', () => {
  it('keeps the same appbar and bottom-nav elements across a navigation', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/foods']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/foods" element={<p>foods</p>} />
              <Route path="/recipes" element={<p>recipes</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const header = container.querySelector('header');
    const tick = header?.querySelector('span');
    const navs = container.querySelectorAll('nav');
    expect(header).toBeTruthy();
    expect(navs.length).toBeGreaterThan(0);

    const link = [...container.querySelectorAll('nav a')].find(
      (a) => a.getAttribute('href') === '/recipes',
    );
    if (!link) throw new Error('Recettes nav link not found');
    fireEvent.click(link);

    // The page swapped…
    expect(container.textContent).toContain('recipes');
    // …and the frame did not: same DOM nodes, so the tick's animation never restarts.
    expect(container.querySelector('header')).toBe(header);
    expect(container.querySelector('header')?.querySelector('span')).toBe(tick);
    expect(container.querySelectorAll('nav')[navs.length - 1]).toBe(navs[navs.length - 1]);
  });
});
