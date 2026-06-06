import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { LeftoverGroup, Meal } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { LeftoverList } from './LeftoverList';

// B-047: the ⊟ Restes button opens a list of applied leftovers; from there the user adds a new
// one or edits/removes an existing one.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const GROUP: LeftoverGroup = {
  id: 'g1',
  container_name: 'Bol',
  tare_g: 408,
  gross_grams: 508,
  leftover_net_grams: 100,
  entry_ids: ['e1', 'e2'],
};

function meal(groups: LeftoverGroup[]): Meal {
  return {
    id: 'm1',
    slot_name: 'Dîner',
    order_index: 0,
    entries: [],
    leftover_groups: groups,
    totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
  };
}

function renderList(
  groups: LeftoverGroup[],
  onNew = vi.fn(),
  onEdit = vi.fn(),
  mutateAsync = vi.fn(),
) {
  const ctrl = {
    mutations: { removeLeftover: { mutateAsync, isPending: false } },
  } as unknown as MealsController;
  const utils = render(
    <MealsProvider value={ctrl}>
      <LeftoverList meal={meal(groups)} onNew={onNew} onEdit={onEdit} />
    </MealsProvider>,
  );
  return { ...utils, onNew, onEdit, mutateAsync };
}

describe('LeftoverList (B-047)', () => {
  it('shows an empty state when no leftover is applied', () => {
    const { getByText } = renderList([]);
    expect(getByText('Aucun reste déduit sur ce repas.')).toBeTruthy();
  });

  it('lists a group and edits it on click', () => {
    const { getByText, onEdit } = renderList([GROUP]);
    expect(getByText('Bol')).toBeTruthy();
    expect(getByText('−100 g · 2 ligne(s)')).toBeTruthy();
    fireEvent.click(getByText('Modifier'));
    expect(onEdit).toHaveBeenCalledWith(GROUP);
  });

  it('removes a group via the delete button', () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    const { getByText } = renderList([GROUP], vi.fn(), vi.fn(), mutateAsync);
    fireEvent.click(getByText('Supprimer'));
    expect(mutateAsync).toHaveBeenCalledWith('g1');
  });

  it('starts a new leftover', () => {
    const { getByText, onNew } = renderList([]);
    fireEvent.click(getByText(/Nouveau reste/));
    expect(onNew).toHaveBeenCalled();
  });
});
