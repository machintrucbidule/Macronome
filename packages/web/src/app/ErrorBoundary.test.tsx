import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../i18n/config';
import { ErrorBoundary } from './ErrorBoundary';
import { AppShell } from './AppShell';

// B-265: a screen that throws used to unmount the whole tree — blank window, no message, no way
// back. It must now show a recovery card, keep the frame usable, and clear itself on navigation.
afterEach(cleanup);

// React logs the caught error; silence it so a passing run stays readable.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary (B-265)', () => {
  it('renders the recovery card, naming what failed, instead of nothing', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(i18n.t('fatal.title'))).toBeTruthy();
    expect(screen.getByText('kaboom')).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('fatal.reload') })).toBeTruthy();
  });

  it('renders its children untouched when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// The route-level boundary lives in AppShell, keyed on the pathname: the nav survives a crashed
// screen, and leaving the screen clears the card (React never resets a boundary on its own).
function shell(initial: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/foods" element={<Boom />} />
            <Route path="/recipes" element={<GoodScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function GoodScreen() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate('/foods')}>
      break it
    </button>
  );
}

describe('AppShell route boundary (B-265)', () => {
  it('keeps the app frame usable when a screen fails', () => {
    const { container } = shell('/foods');
    expect(screen.getByText(i18n.t('fatal.title'))).toBeTruthy();
    // The nav is still there: the failure took the screen, not the shell.
    expect(container.querySelector('nav')).toBeTruthy();
  });

  it('clears the card when you navigate away from the crashed screen', () => {
    const { container } = shell('/foods');
    expect(screen.getByText(i18n.t('fatal.title'))).toBeTruthy();

    // Leave via the shell's own nav — the point of the route-level boundary is that this still
    // works. Without the pathname key the card would survive the navigation.
    const link = [...container.querySelectorAll('nav a')].find(
      (a) => a.getAttribute('href') === '/recipes',
    );
    if (!link) throw new Error('Recettes nav link not found');
    fireEvent.click(link);

    expect(screen.queryByText(i18n.t('fatal.title'))).toBeNull();
    expect(screen.getByRole('button', { name: 'break it' })).toBeTruthy();
  });
});
