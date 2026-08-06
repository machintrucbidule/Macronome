import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Food, FoodRef } from '@macronome/shared';
import i18n from '../../i18n/config';
import { foodsApi } from '../../api/foods';
import { foodRefsApi } from '../../api/foodRefs';
import { settingsApi } from '../../api/settings';
import { FoodsPage } from './FoodsPage';

// B-292: the Aliments screen has two modes. The page owns only what they share — the mode and
// the search text — so these tests exercise the seam, not the two lists in detail.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const APPLE: FoodRef = {
  id: 'r1',
  code: '13039',
  name_fr: 'Pomme, chair et peau, crue',
  name_eng: 'Apple, flesh and skin, raw',
  group_label_fr: 'fruits, légumes, légumineuses et oléagineux',
  group_label_eng: 'fruits, vegetables, legumes and nuts',
  kcal_per_100g: 54,
  fat_per_100g: 0.1,
  carb_per_100g: 11.3,
  protein_per_100g: 0.3,
  energy_derived: false,
  already_owned: false,
};

function mockApis() {
  vi.spyOn(foodsApi, 'list').mockResolvedValue({
    data: [],
    next_cursor: null,
    total: 0,
    sources: ['manual'],
  });
  vi.spyOn(foodRefsApi, 'list').mockResolvedValue({
    data: [APPLE],
    next_cursor: null,
    total: 1,
  });
  vi.spyOn(foodRefsApi, 'groups').mockResolvedValue({ data: ['produits céréaliers'] });
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

const toCatalog = (r: RenderResult): void => {
  fireEvent.click(r.getByRole('button', { name: i18n.t('foods.mode.catalog') }));
};

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('FoodsPage — mode switch (B-292)', () => {
  it('keeps the search text when switching to the catalog', async () => {
    mockApis();
    const r = render(<FoodsPage />, { wrapper });

    const search = r.getByPlaceholderText(i18n.t('foods.searchPlaceholder')) as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'pomme' } });
    toCatalog(r);

    // The field is the same one, and the catalog query inherits the term rather than
    // making the user type it again.
    const after = r.getByPlaceholderText(i18n.t('foods.searchPlaceholder')) as HTMLInputElement;
    expect(after.value).toBe('pomme');
    await waitFor(() =>
      expect(foodRefsApi.list).toHaveBeenCalledWith(expect.objectContaining({ q: 'pomme' })),
    );
  });

  it('greys the "+ Ajouter un aliment" button in the catalog, and restores it on the way back', () => {
    mockApis();
    const r = render(<FoodsPage />, { wrapper });
    const addBtn = () => r.getByRole('button', { name: i18n.t('foods.add') }) as HTMLButtonElement;

    expect(addBtn().disabled).toBe(false);
    toCatalog(r);
    expect(addBtn().disabled).toBe(true);

    fireEvent.click(r.getByRole('button', { name: i18n.t('foods.mode.library') }));
    expect(addBtn().disabled).toBe(false);
  });
});

// B-299: a first click on a numeric column used to list the smallest values first.
describe('FoodsPage — first click sorts in the useful direction (B-299)', () => {
  const clickHeader = async (r: RenderResult, field: string): Promise<void> => {
    const th = await waitFor(() =>
      r.getByRole('button', { name: new RegExp(`^${i18n.t(`foods.col.${field}`)}`) }),
    );
    fireEvent.click(th);
  };
  const sortedBy = async (sort: string, dir: string): Promise<void> => {
    await waitFor(() =>
      expect(foodsApi.list).toHaveBeenCalledWith(expect.objectContaining({ sort, dir })),
    );
  };

  it('starts a numeric column descending and a text column ascending', async () => {
    mockApis();
    // The sortable headers only render with rows — the empty state replaces the table.
    vi.mocked(foodsApi.list).mockResolvedValue({
      data: [{ id: 'f1', name: 'Pomme', named_portions: [] } as unknown as Food],
      next_cursor: null,
      total: 1,
      sources: ['manual'],
    });
    const r = render(<FoodsPage />, { wrapper });

    await clickHeader(r, 'kcal');
    await sortedBy('kcal', 'desc');

    // Re-clicking the active column still toggles.
    await clickHeader(r, 'kcal');
    await sortedBy('kcal', 'asc');

    await clickHeader(r, 'source');
    await sortedBy('source', 'asc');
  });
});

describe('FoodsPage — adopting a catalog entry (B-292)', () => {
  it('opens the food form prefilled, and saving keeps the user in the catalog', async () => {
    mockApis();
    const createSpy = vi
      .spyOn(foodsApi, 'create')
      .mockResolvedValue({ data: { id: 'f1' } as unknown as Food });
    const r = render(<FoodsPage />, { wrapper });
    toCatalog(r);

    // The whole row adopts — same gesture as a row of Mes aliments.
    const row = await waitFor(() => r.getByText(APPLE.name_fr));
    fireEvent.click(row);

    const nameField = r.getByLabelText(i18n.t('foods.field.name')) as HTMLInputElement;
    expect(nameField.value).toBe(APPLE.name_fr);

    fireEvent.click(r.getByRole('button', { name: i18n.t('common.save') }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({
      name: APPLE.name_fr,
      kcal_per_100g: 54,
      source: 'ciqual',
      visibility: 'shared',
      // The food group is shown under the name in the list, never copied onto the food (D10).
      comment: null,
      named_portions: [],
    });

    // Still in the catalog: adding several in a row is the point (owner decision).
    expect(
      r.getByRole('button', { name: i18n.t('foods.mode.catalog') }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
