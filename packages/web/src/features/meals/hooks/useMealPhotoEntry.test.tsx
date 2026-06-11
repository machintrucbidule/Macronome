import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import type { DishPhotoMacros, Meal } from '@macronome/shared';

// QP-1/B-158: the mobile one-tap photo entry. We mock the platform flag, the settings query, the AI
// mutation, the meals controller, and readAsDataUrl so the test exercises only the hook's decision
// logic: gating (ready), success→openCustom, no-food→message, error→message.
const mocks = vi.hoisted(
  (): {
    isMobile: boolean;
    settings: { ai: unknown } | null;
    response: { data: DishPhotoMacros } | null;
    error: unknown;
    openCustom: ReturnType<typeof vi.fn>;
  } => ({
    isMobile: true,
    settings: null,
    response: null,
    error: null,
    openCustom: vi.fn(),
  }),
);

vi.mock('../../../lib/useIsMobile', () => ({ useIsMobile: () => mocks.isMobile }));
vi.mock('../../settings/useSettings', () => ({
  useSettingsQuery: () => ({ data: mocks.settings ? { data: mocks.settings } : undefined }),
}));
vi.mock('../MealsContext', () => ({
  useMeals: () => ({ actions: { openCustom: mocks.openCustom } }),
}));
vi.mock('./useAi', () => ({
  useDishPhotoMacros: () => ({
    mutate: (
      _vars: unknown,
      opts: {
        onSuccess?: (res: { data: DishPhotoMacros }) => void;
        onError?: (err: unknown) => void;
        onSettled?: () => void;
      },
    ) => {
      if (mocks.error) opts.onError?.(mocks.error);
      else if (mocks.response) opts.onSuccess?.(mocks.response);
      opts.onSettled?.();
    },
  }),
}));
vi.mock('../lib/imagePick', async (orig) => ({
  ...(await orig<typeof import('../lib/imagePick')>()),
  readAsDataUrl: () => Promise.resolve('data:image/jpeg;base64,AAA'),
}));

import { useMealPhotoEntry } from './useMealPhotoEntry';

const CONFIGURED = {
  ai: {
    provider: 'openai_compatible',
    base_url: 'http://x',
    api_key_set: true,
    tasks: {
      dish_photo_macros: { model: 'm', prompt: '' },
      meal_suggestions: { model: null, prompt: '' },
      advice: { model: null, prompt: '' },
    },
  },
};
const FOUND: DishPhotoMacros = {
  detected: true,
  dish_name: 'Pasta',
  kcal: 620,
  weight_g: 350,
  fat_g: 18,
  carb_g: 80,
  protein_g: 24,
};
const meal = {
  id: 'meal-1',
  order_index: 0,
  slot_name: 'X',
  entries: [],
  leftover_groups: [],
} as unknown as Meal;

function fakeChange(): ChangeEvent<HTMLInputElement> {
  return {
    target: { files: [{ type: 'image/jpeg' } as File], value: 'x' },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isMobile = true;
  mocks.settings = null;
  mocks.response = null;
  mocks.error = null;
});

describe('useMealPhotoEntry — gating', () => {
  it('is not ready on desktop even when configured', () => {
    mocks.isMobile = false;
    mocks.settings = CONFIGURED;
    const { result } = renderHook(() => useMealPhotoEntry(meal));
    expect(result.current.ready).toBe(false);
  });

  it('is not ready on mobile when the dish-photo model is unset', () => {
    mocks.settings = {
      ai: {
        ...CONFIGURED.ai,
        tasks: { ...CONFIGURED.ai.tasks, dish_photo_macros: { model: null, prompt: '' } },
      },
    };
    const { result } = renderHook(() => useMealPhotoEntry(meal));
    expect(result.current.ready).toBe(false);
  });

  it('is ready on mobile when configured', () => {
    mocks.settings = CONFIGURED;
    const { result } = renderHook(() => useMealPhotoEntry(meal));
    expect(result.current.ready).toBe(true);
  });
});

describe('useMealPhotoEntry — analysis outcomes', () => {
  it('on detected:true opens the prefilled custom modal at the first free slot', async () => {
    mocks.settings = CONFIGURED;
    mocks.response = { data: FOUND };
    const { result } = renderHook(() => useMealPhotoEntry(meal));
    await act(async () => {
      result.current.inputProps.onChange(fakeChange());
      await Promise.resolve();
    });
    expect(mocks.openCustom).toHaveBeenCalledWith('meal-1', 0, null, 0, {
      name: 'Pasta',
      kcal: 620,
      servedGrams: 350,
      snap: { kcal: 620, fat: 18, carb: 80, protein: 24 },
    });
    expect(result.current.message).toBeNull();
  });

  it('on detected:false shows the no-food message and does not open the modal', async () => {
    mocks.settings = CONFIGURED;
    mocks.response = { data: { ...FOUND, detected: false } };
    const { result } = renderHook(() => useMealPhotoEntry(meal));
    await act(async () => {
      result.current.inputProps.onChange(fakeChange());
      await Promise.resolve();
    });
    expect(mocks.openCustom).not.toHaveBeenCalled();
    expect(result.current.message?.key).toBe('meals.aiAnalysis.noFood');
  });

  it('on error shows a dismissible warning and adds nothing', async () => {
    mocks.settings = CONFIGURED;
    mocks.error = new Error('boom');
    const { result } = renderHook(() => useMealPhotoEntry(meal));
    await act(async () => {
      result.current.inputProps.onChange(fakeChange());
      await Promise.resolve();
    });
    expect(mocks.openCustom).not.toHaveBeenCalled();
    expect(result.current.message?.tone).toBe('warning');
    expect(result.current.message?.dismissible).toBe(true);
  });
});
