import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '../../../../i18n/config';
import type { EditTarget } from '../../hooks/mealActions';
import { FoodPickerSheet } from './FoodPickerSheet';

// B-206: the mobile food picker must focus its search input on open (so the keyboard opens),
// not the modal's header "×". The focus lands via the Modal focus-trap initial-focus target
// (initialFocusRef) — asserted here through document.activeElement. The open-keyboard reflow is
// not jsdom-observable and is checked visually on a device.

vi.mock('../../MealsContext', () => ({
  useMeals: () => ({
    actions: { pickFood: vi.fn(), openCustom: vi.fn(), closeEdit: vi.fn() },
    day: null,
  }),
}));
vi.mock('../../hooks/useFoodLookup', () => ({
  useFoodSearch: () => ({ data: { data: [] } }),
}));

const target: EditTarget = {
  mealId: 'm1',
  mealIndex: 0,
  entryId: null,
  orderIndex: null,
  initialQuery: '',
};

afterEach(cleanup);

describe('FoodPickerSheet', () => {
  it('focuses the search input on open', () => {
    render(<FoodPickerSheet target={target} />);
    const input = document.querySelector('input');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
