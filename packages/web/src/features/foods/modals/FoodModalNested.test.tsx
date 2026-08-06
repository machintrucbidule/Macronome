import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../../i18n/config';
import { settingsApi } from '../../../api/settings';
import { resetOverlayStack } from '../../../components/Modal/useOverlayDismiss';
import { FoodModal } from './FoodModal';

// B-300: leaving a sub-dialog opened over the food modal ("Parser macro", Chronodrive search) used
// to close the food modal too — the whole form vanished with whatever had been typed in it. The
// contract is explicit (design/components/modals.md §Nested overlays): a dismissal closes the
// top-most overlay only, the one beneath stays open. The mechanism is exercised in
// components/Modal/overlayDismiss.test.tsx; this file proves it on the real screen.
//
// The overlay stack drives history entries, so the whole back()/popstate chain is faked here the
// same way (a no-op back() would hide the very cascade under test).
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function installFakeHistory(): void {
  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);
  const entries: unknown[] = [window.history.state];
  vi.spyOn(window.history, 'pushState').mockImplementation((state: unknown) => {
    entries.push(state);
    origPush(state, '');
  });
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    if (entries.length <= 1) return;
    entries.pop();
    origReplace(entries[entries.length - 1] ?? null, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
}

beforeEach(() => {
  resetOverlayStack();
  installFakeHistory();
  vi.spyOn(settingsApi, 'get').mockResolvedValue({
    data: { integrations: { barclaude_gateway: null } },
  } as never);
});

afterEach(async () => {
  cleanup();
  resetOverlayStack();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

/** The deferred consume runs a tick after the child unmounts — wait it out. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

describe('FoodModal — a sub-dialog closes alone (B-300)', () => {
  it('keeps the food form open when the macro-parse dialog is cancelled', async () => {
    const onClose = vi.fn();
    const r = render(
      <FoodModal
        food={null}
        presentSources={['manual']}
        isDuplicate={() => false}
        onClose={onClose}
        onArchive={vi.fn()}
      />,
      { wrapper },
    );

    // Type something first: the point of the bug is that the draft was lost.
    fireEvent.change(r.getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Yaourt grec' },
    });

    fireEvent.click(r.getByRole('button', { name: i18n.t('foods.parse.open') }));
    const sub = await waitFor(() => r.getByRole('dialog', { name: i18n.t('foods.parse.title') }));

    // Cancel the SUB-dialog (both dialogs carry an "Annuler" — scope to the top one).
    fireEvent.click(within(sub).getByRole('button', { name: i18n.t('common.cancel') }));
    await waitFor(() => expect(r.queryByText(i18n.t('foods.parse.title'))).toBeNull());
    await flush();

    expect(onClose).not.toHaveBeenCalled();
    expect(r.getByText(i18n.t('foods.modal.addTitle'))).toBeTruthy();
    expect((r.getByLabelText(i18n.t('foods.field.name')) as HTMLInputElement).value).toBe(
      'Yaourt grec',
    );
  });

  it('keeps the food form open when the macro-parse dialog is dismissed with Escape', async () => {
    const onClose = vi.fn();
    const r = render(
      <FoodModal
        food={null}
        presentSources={['manual']}
        isDuplicate={() => false}
        onClose={onClose}
        onArchive={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(r.getByRole('button', { name: i18n.t('foods.parse.open') }));
    await waitFor(() => expect(r.getByText(i18n.t('foods.parse.title'))).toBeTruthy());

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(r.queryByText(i18n.t('foods.parse.title'))).toBeNull());
    await flush();

    expect(onClose).not.toHaveBeenCalled();
    expect(r.getByText(i18n.t('foods.modal.addTitle'))).toBeTruthy();
  });
});
