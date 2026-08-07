import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Food } from '@macronome/shared';
import i18n from '../../i18n/config';
import { foodsApi } from '../../api/foods';
import { foodRefsApi } from '../../api/foodRefs';
import { settingsApi } from '../../api/settings';
import { FoodsPage } from './FoodsPage';

// BE-1 on the Aliments screen: the header checkbox selects the WHOLE filtered set (a server round
// trip, because the list holds one page), one selected row opens the ordinary form, and two or
// more open the batch popup whose request carries only the fields that were set.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function food(id: string, name: string): Food {
  const row: Food = {
    id,
    owner_id: 'u1',
    name,
    kcal_per_100g: 100,
    fat_per_100g: 1,
    carb_per_100g: 2,
    protein_per_100g: 3,
    comment: null,
    rating: null,
    visibility: 'private',
    source: 'manual',
    ai_proposable: true,
    recipe_id: null,
    named_portions: [],
    archived_at: null,
  };
  return row;
}

const ROWS = [food('f1', 'Avoine'), food('f2', 'Beurre')];

function mockApis() {
  vi.spyOn(foodsApi, 'list').mockResolvedValue({
    data: ROWS,
    next_cursor: null,
    total: 2,
    with_comment: 0,
    sources: ['manual'],
  });
  // The whole matching set, deliberately larger than the page would be in real life.
  vi.spyOn(foodsApi, 'ids').mockResolvedValue({ data: ['f1', 'f2'] });
  vi.spyOn(foodsApi, 'bulkUpdate').mockResolvedValue({ updated: 2 });
  vi.spyOn(foodRefsApi, 'list').mockResolvedValue({
    data: [],
    next_cursor: null,
    total: 0,
  });
  vi.spyOn(foodRefsApi, 'groups').mockResolvedValue({ data: [] });
  vi.spyOn(settingsApi, 'get').mockResolvedValue({
    data: {
      locale: 'fr',
      theme: 'dark',
      ai: null,
      integrations: { home_assistant: null, barclaude_gateway: null, google_drive: null },
      current_mode: null,
      open_period_note: null,
      lines_desktop: 20,
      lines_mobile: 15,
      min_meal_columns: 4,
    },
  });
}

const rowBox = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name: i18n.t('bulk.selectRow', { name }) });

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('Aliments — batch edit (BE-1)', () => {
  it('the header checkbox selects everything the filter matches, not just the loaded rows', async () => {
    mockApis();
    render(<FoodsPage />, { wrapper });
    await screen.findByText('Avoine');

    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('bulk.selectAll') }));
    // Answered by the server, because the client cannot know rows it has not fetched.
    await waitFor(() => expect(foodsApi.ids).toHaveBeenCalled());
    await screen.findByText(i18n.t('bulk.selected', { count: 2 }));
  });

  it('opens the ordinary form at one selected and the batch popup at two', async () => {
    mockApis();
    render(<FoodsPage />, { wrapper });
    await screen.findByText('Avoine');

    fireEvent.click(rowBox('Avoine'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.edit') }));
    // A reduced form for a single food would be a worse form: this is the normal edit modal.
    expect(screen.getByText(i18n.t('foods.modal.editTitle'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));

    fireEvent.click(rowBox('Beurre'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.edit') }));
    // By its subtitle, which names the count — the popup's title repeats the toolbar button's.
    expect(
      screen.getByText(i18n.t('bulk.sub', { what: i18n.t('foods.count', { count: 2 }) })),
    ).toBeTruthy();
  });

  it('sends only the field that was set, and keeps the selection afterwards', async () => {
    mockApis();
    render(<FoodsPage />, { wrapper });
    await screen.findByText('Avoine');

    fireEvent.click(rowBox('Avoine'));
    fireEvent.click(rowBox('Beurre'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.edit') }));

    // Set Visibilité alone; every other control stays on « Ne pas modifier ».
    fireEvent.click(screen.getByRole('button', { name: i18n.t('foods.visibility.shared') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.continue') }));
    // The recap states what will change before anything is written.
    expect(screen.getByText(i18n.t('bulk.recap.title'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.apply') }));

    await waitFor(() =>
      expect(foodsApi.bulkUpdate).toHaveBeenCalledWith({
        ids: ['f1', 'f2'],
        patch: { visibility: 'shared' },
      }),
    );
    // Owner decision: the selection survives, so a second field can follow without re-ticking.
    expect(screen.getByText(i18n.t('bulk.selected', { count: 2 }))).toBeTruthy();
  });

  // B-329. The popup used to read the LIVE selection at write time, and the selection is dropped
  // whenever the filter changes (a frozen set must not outlive its filter). Typing in the search
  // box while the popup is open did exactly that: the write went out with `ids: []`, the API
  // answered 422, and the screen showed nothing at all — the popup closed and no row changed.
  // The ids are now frozen when the popup opens, which is also the set the recap counted.
  it('writes the ids the popup was opened on, even if the selection is dropped meanwhile', async () => {
    mockApis();
    render(<FoodsPage />, { wrapper });
    await screen.findByText('Avoine');

    fireEvent.click(rowBox('Avoine'));
    fireEvent.click(rowBox('Beurre'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.edit') }));

    // The filter changes under the open popup — this is what cleared the selection.
    fireEvent.change(screen.getByPlaceholderText(i18n.t('foods.searchPlaceholder')), {
      target: { value: 'Avo' },
    });
    await waitFor(() =>
      expect(screen.queryByText(i18n.t('bulk.selected', { count: 2 }))).toBeNull(),
    );

    fireEvent.click(screen.getByRole('button', { name: i18n.t('foods.visibility.shared') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.continue') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('bulk.apply') }));

    await waitFor(() =>
      expect(foodsApi.bulkUpdate).toHaveBeenCalledWith({
        ids: ['f1', 'f2'],
        patch: { visibility: 'shared' },
      }),
    );
  });
});
