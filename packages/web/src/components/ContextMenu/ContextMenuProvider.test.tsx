import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../i18n/config';
import { ContextMenuProvider } from './ContextMenuProvider';
import { useContextMenuZone } from './ContextMenuContext';

// B-195: the delegated contextmenu listener is attached only when standalone && desktop;
// text fields keep the native menu; a registered zone resolver wins over the generic menu
// (Aller à / Actualiser); Escape closes. fireEvent.contextMenu returns false when the
// default was prevented (= our menu replaced the native one).
const mocks = vi.hoisted(() => ({ standalone: true, mobile: false }));
vi.mock('../../lib/useIsStandalone', () => ({ useIsStandalone: () => mocks.standalone }));
vi.mock('../../lib/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));

function Zone({ onPick }: { onPick: () => void }) {
  useContextMenuZone((target) =>
    target.closest('[data-zone-row]')
      ? { items: [{ key: 'z', label: 'Zone action', onSelect: onPick }] }
      : null,
  );
  return <div data-zone-row="">row</div>;
}

function renderApp(zonePick = vi.fn()) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ContextMenuProvider>
          <div data-testid="plain">plain</div>
          <textarea data-testid="field" />
          <Zone onPick={zonePick} />
        </ContextMenuProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return zonePick;
}

afterEach(() => {
  cleanup();
  mocks.standalone = true;
  mocks.mobile = false;
  vi.restoreAllMocks();
});

const goTo = (): string => i18n.t('contextMenu.goTo');

describe('ContextMenuProvider (B-195)', () => {
  it('is inert outside the installed window (browser tab keeps the native menu)', () => {
    mocks.standalone = false;
    renderApp();
    const notPrevented = fireEvent.contextMenu(screen.getByTestId('plain'));
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('is inert on the mobile layout even when standalone', () => {
    mocks.mobile = true;
    renderApp();
    expect(fireEvent.contextMenu(screen.getByTestId('plain'))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the generic menu (Aller à + Actualiser) anywhere unresolved, replacing the native one', () => {
    renderApp();
    const notPrevented = fireEvent.contextMenu(screen.getByTestId('plain'));
    expect(notPrevented).toBe(false);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText(goTo())).toBeTruthy();
    expect(screen.getByText(i18n.t('contextMenu.refresh'))).toBeTruthy();
  });

  it('keeps the native menu inside text fields', () => {
    renderApp();
    expect(fireEvent.contextMenu(screen.getByTestId('field'))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a registered zone resolver wins over the generic menu and its action fires on click', () => {
    const zonePick = renderApp();
    fireEvent.contextMenu(screen.getByText('row'));
    expect(screen.getByText('Zone action')).toBeTruthy();
    expect(screen.queryByText(goTo())).toBeNull(); // zone did not append the generic block
    fireEvent.click(screen.getByText('Zone action'));
    expect(zonePick).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull(); // selecting closes
  });

  it('Escape closes the menu', () => {
    renderApp();
    fireEvent.contextMenu(screen.getByTestId('plain'));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
