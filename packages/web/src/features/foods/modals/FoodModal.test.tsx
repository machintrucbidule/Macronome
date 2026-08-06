import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChronoProductResponse, Food, FoodSource, Settings } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { foodsApi } from '../../../api/foods';
import { settingsApi } from '../../../api/settings';
import { integrationsApi } from '../../../api/integrations';
import { FoodModal } from './FoodModal';

// AI meal-proposals S3 (B-123): the food add/edit modal exposes the `ai_proposable`
// toggle ("Dispo pour recettes IA") as a segmented Oui/Non control. New foods default
// ON; toggling Non persists `ai_proposable: false`; editing hydrates from the stored value.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function renderModal(food: Food | null, presentSources: FoodSource[] = ['manual']) {
  return render(
    <FoodModal
      food={food}
      presentSources={presentSources}
      isDuplicate={() => false}
      onClose={vi.fn()}
      onArchive={vi.fn()}
    />,
    {
      wrapper,
    },
  );
}

function editableFood(aiProposable: boolean): Food {
  return {
    id: 'f1',
    name: 'Yaourt grec',
    kcal_per_100g: 60,
    fat_per_100g: 0,
    carb_per_100g: 4,
    protein_per_100g: 10,
    comment: null,
    rating: 2,
    visibility: 'private',
    source: 'manual',
    ai_proposable: aiProposable,
    named_portions: [],
    archived_at: null,
  } as unknown as Food;
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

// --- Chronodrive search (B-182) helpers --------------------------------------

function settingsWith(gatewayConfigured: boolean): Settings {
  return {
    locale: 'fr',
    theme: 'dark',
    ai: null,
    integrations: {
      home_assistant: null,
      barclaude_gateway: gatewayConfigured
        ? { base_url: 'http://gw.local:8080', api_key_set: true }
        : null,
      google_drive: null,
    },
    current_mode: null,
    open_period_note: null,
    lines_desktop: 20,
    lines_mobile: 15,
    min_meal_columns: 4,
  };
}

function chronoProduct(overrides: Partial<ChronoProductResponse['food_prefill']>) {
  return {
    data: {
      id: 'p1',
      name: 'Spaghetti',
      brand: 'Panzani',
      image_url: null,
      unit_quantity_label: '500 g',
      price_eur: 1.15,
      product_url: 'https://www.chronodrive.com/p-Pp1',
      food_prefill: {
        name: 'Panzani Spaghetti',
        kcal_per_100g: 361,
        fat_per_100g: 1.4,
        carb_per_100g: 72,
        protein_per_100g: 12,
        comment: '500 g',
        ...overrides,
      },
    },
  };
}

const macroValue = (r: RenderResult, label: string): string =>
  (r.getByRole('spinbutton', { name: new RegExp(`^${label}`) }) as HTMLInputElement).value;

/** Open the dialog, search, and pick the first result (search + product mocked). */
async function searchAndChoose(r: RenderResult): Promise<void> {
  fireEvent.click(r.getByRole('button', { name: i18n.t('foods.chrono.link') }));
  fireEvent.change(r.getByPlaceholderText(i18n.t('foods.chrono.placeholder')), {
    target: { value: 'spaghetti' },
  });
  const choose = await waitFor(
    () => r.getByRole('button', { name: i18n.t('foods.chrono.choose') }),
    { timeout: 2000 }, // covers the 300 ms search debounce
  );
  fireEvent.click(choose);
}

describe('FoodModal — Chronodrive search (B-182)', () => {
  it('hides the link when the gateway is not configured', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(false) });
    const r = renderModal(null);
    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());
    expect(r.queryByRole('button', { name: i18n.t('foods.chrono.link') })).toBeNull();
  });

  it('fills name, macros and comment from the chosen product', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(true) });
    vi.spyOn(integrationsApi, 'searchProducts').mockResolvedValue({
      data: [chronoProduct({}).data],
    });
    vi.spyOn(integrationsApi, 'getProduct').mockResolvedValue(chronoProduct({}));
    const r = renderModal(null);
    await waitFor(() =>
      expect(r.getByRole('button', { name: i18n.t('foods.chrono.link') })).toBeTruthy(),
    );

    await searchAndChoose(r);

    await waitFor(() => expect(macroValue(r, i18n.t('foods.field.kcal'))).toBe('361'));
    expect((r.getByLabelText(i18n.t('foods.field.name')) as HTMLInputElement).value).toBe(
      'Panzani Spaghetti',
    );
    expect(macroValue(r, i18n.t('foods.field.fat'))).toBe('1.4');
    expect(macroValue(r, i18n.t('foods.field.carb'))).toBe('72');
    expect(macroValue(r, i18n.t('foods.field.protein'))).toBe('12');
    expect(r.queryByText(i18n.t('foods.chrono.incomplete'))).toBeNull();
  });

  it('leaves an undeclared macro empty and shows the "à compléter" notice', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(true) });
    vi.spyOn(integrationsApi, 'searchProducts').mockResolvedValue({
      data: [chronoProduct({}).data],
    });
    vi.spyOn(integrationsApi, 'getProduct').mockResolvedValue(
      chronoProduct({ fat_per_100g: null }),
    );
    const r = renderModal(null);
    await waitFor(() =>
      expect(r.getByRole('button', { name: i18n.t('foods.chrono.link') })).toBeTruthy(),
    );

    await searchAndChoose(r);

    await waitFor(() => expect(macroValue(r, i18n.t('foods.field.kcal'))).toBe('361'));
    expect(macroValue(r, i18n.t('foods.field.fat'))).toBe('');
    expect(r.getByText(i18n.t('foods.chrono.incomplete'), { exact: false })).toBeTruthy();
  });
});

// B-290: `food.source` used to be dead — every food was persisted as 'manual', including the
// ones built from a Chronodrive product. The save payload now carries the provenance.
describe('FoodModal — source provenance (B-290)', () => {
  it('saves a Chronodrive-prefilled food as source: chronodrive', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(true) });
    vi.spyOn(integrationsApi, 'searchProducts').mockResolvedValue({
      data: [chronoProduct({}).data],
    });
    vi.spyOn(integrationsApi, 'getProduct').mockResolvedValue(chronoProduct({}));
    const createSpy = vi.spyOn(foodsApi, 'create').mockResolvedValue({ data: editableFood(true) });
    const r = renderModal(null);
    await waitFor(() =>
      expect(r.getByRole('button', { name: i18n.t('foods.chrono.link') })).toBeTruthy(),
    );

    await searchAndChoose(r);
    await waitFor(() => expect(macroValue(r, i18n.t('foods.field.kcal'))).toBe('361'));
    fireEvent.click(r.getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ source: 'chronodrive' });
  });

  it('saves a hand-typed food as source: manual', async () => {
    const createSpy = vi.spyOn(foodsApi, 'create').mockResolvedValue({ data: editableFood(true) });
    const { getByLabelText, getByRole } = renderModal(null);

    fireEvent.change(getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Blanc de poulet' },
    });
    fireEvent.click(getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ source: 'manual' });
  });
});

describe('FoodModal — ai_proposable toggle (S3 / B-123)', () => {
  it('defaults a new food to ai_proposable: true on save', async () => {
    const createSpy = vi.spyOn(foodsApi, 'create').mockResolvedValue({ data: editableFood(true) });
    const { getByLabelText, getByRole } = renderModal(null);

    fireEvent.change(getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Blanc de poulet' },
    });
    fireEvent.click(getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ ai_proposable: true });
  });

  it('persists ai_proposable: false when the user picks Non', async () => {
    const createSpy = vi.spyOn(foodsApi, 'create').mockResolvedValue({ data: editableFood(false) });
    const { getByLabelText, getByRole } = renderModal(null);

    fireEvent.change(getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Blanc de poulet' },
    });
    fireEvent.click(getByRole('button', { name: i18n.t('common.no') }));
    fireEvent.click(getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ ai_proposable: false });
  });

  it('hydrates the toggle from an existing food (Non pressed when stored false)', () => {
    const { getByRole } = renderModal(editableFood(false));
    expect(getByRole('button', { name: i18n.t('common.no') }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(getByRole('button', { name: i18n.t('common.yes') }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});

// B-295: the provenance is correctable by hand from the food form. "Chronodrive" is offered only
// when it can mean something — a food already carries it, or the gateway is configured — so the
// control never proposes a provenance the instance cannot produce.
describe('FoodModal — source selector (B-295)', () => {
  const sourceButton = (r: RenderResult, key: string) =>
    r.queryByRole('button', { name: i18n.t(`foods.source.${key}`) });

  it('offers Manuel and Ciqual but not Chronodrive with neither food nor integration', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(false) });
    const r = renderModal(null, ['manual']);
    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());

    expect(sourceButton(r, 'manual')).toBeTruthy();
    expect(sourceButton(r, 'ciqual')).toBeTruthy();
    expect(sourceButton(r, 'chronodrive')).toBeNull();
  });

  it('offers Chronodrive once the integration is configured', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(true) });
    const r = renderModal(null, ['manual']);
    await waitFor(() => expect(sourceButton(r, 'chronodrive')).toBeTruthy());
  });

  it('offers Chronodrive when a food already carries it, integration or not', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(false) });
    const r = renderModal(null, ['chronodrive', 'manual']);
    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());
    expect(sourceButton(r, 'chronodrive')).toBeTruthy();
  });

  it('sends the corrected provenance when editing an existing food', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(false) });
    const updateSpy = vi.spyOn(foodsApi, 'update').mockResolvedValue({ data: editableFood(true) });
    const r = renderModal(editableFood(true), ['manual']);
    await waitFor(() => expect(sourceButton(r, 'ciqual')).toBeTruthy());

    fireEvent.click(sourceButton(r, 'ciqual')!);
    fireEvent.click(r.getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0]?.[1]).toMatchObject({ source: 'ciqual' });
  });

  it('leaves an untouched food on the provenance it was hydrated with', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ data: settingsWith(false) });
    const updateSpy = vi.spyOn(foodsApi, 'update').mockResolvedValue({ data: editableFood(true) });
    const r = renderModal(editableFood(true), ['manual']);

    fireEvent.change(r.getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Yaourt grec 0%' },
    });
    fireEvent.click(r.getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0]?.[1]).toMatchObject({ source: 'manual' });
  });
});
