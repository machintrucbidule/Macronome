import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { defaultDirFor } from './sortDir';
import { FOODS_DESC_FIRST } from '../../features/foods/useFoodsFilters';
import {
  CATALOG_DESC_FIRST,
  useCatalogFilters,
} from '../../features/foods/catalog/useCatalogFilters';
import { RECIPES_DESC_FIRST } from '../../features/recipes/RecipesPage';
import { CONTAINERS_DESC_FIRST } from '../../features/containers/ContainersPage';
import { USERS_DESC_FIRST } from '../../features/users/UsersPage';
import { JOURNAL_DESC_FIRST, useJournalSort } from '../../features/journal/useJournalSort';

// B-299 — ONE rule for every table: a first click on a column carrying a number or a date sorts
// descending (most calories, best rating, most-used, most recent); a text column sorts
// alphabetically. This file pins the per-screen classification, column by column, so a new column
// cannot be added without deciding which side it falls on. The mechanism itself is covered by
// sortDir.test.ts, and the wiring end-to-end by FoodsPage.test.tsx.

/** Every sortable column of a screen → the direction its first click must produce. */
const EXPECTED: Record<string, [ReadonlySet<string>, Record<string, 'asc' | 'desc'>]> = {
  Aliments: [
    FOODS_DESC_FIRST,
    {
      name: 'asc',
      source: 'asc',
      visibility: 'asc',
      kcal: 'desc',
      fat: 'desc',
      carb: 'desc',
      protein: 'desc',
      rating: 'desc',
      usage: 'desc',
    },
  ],
  'Catalogue Ciqual': [
    CATALOG_DESC_FIRST,
    { name: 'asc', kcal: 'desc', fat: 'desc', carb: 'desc', protein: 'desc' },
  ],
  Recettes: [RECIPES_DESC_FIRST, { name: 'asc', batch: 'desc', servings: 'desc', rating: 'desc' }],
  Contenants: [CONTAINERS_DESC_FIRST, { name: 'asc', weight: 'desc' }],
  Utilisateurs: [
    USERS_DESC_FIRST,
    { username: 'asc', created: 'desc', lastLogin: 'desc', lastSeen: 'desc' },
  ],
  Historique: [JOURNAL_DESC_FIRST, { date: 'desc', kcal: 'desc', verdict: 'asc', activity: 'asc' }],
};

describe('first-click sort direction, screen by screen (B-299)', () => {
  for (const [screen, [descFirst, columns]] of Object.entries(EXPECTED)) {
    it(`${screen}: every column starts in its useful direction`, () => {
      for (const [field, expected] of Object.entries(columns)) {
        expect(`${field}=${defaultDirFor(field, descFirst)}`).toBe(`${field}=${expected}`);
      }
      // No stale entry: the set must not name a column the screen does not have.
      for (const field of descFirst) expect(Object.keys(columns)).toContain(field);
    });
  }
});

describe('the screens actually apply the rule', () => {
  it('Catalogue Ciqual: kcal first click descending, Nom ascending, re-click toggles', () => {
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.state.dir).toBe('asc'); // default sort on load is unchanged (Nom A→Z)

    act(() => result.current.handlers.onSort('kcal'));
    expect(result.current.state).toMatchObject({ sort: 'kcal', dir: 'desc' });

    act(() => result.current.handlers.onSort('kcal'));
    expect(result.current.state).toMatchObject({ sort: 'kcal', dir: 'asc' });

    act(() => result.current.handlers.onSort('name'));
    expect(result.current.state).toMatchObject({ sort: 'name', dir: 'asc' });
  });

  it('Historique: Calories first click descending, Verdict ascending', () => {
    const { result } = renderHook(() => useJournalSort());
    expect(result.current).toMatchObject({ sort: 'date', dir: 'desc' });

    act(() => result.current.onSort('kcal'));
    expect(result.current).toMatchObject({ sort: 'kcal', dir: 'desc' });

    act(() => result.current.onSort('verdict'));
    expect(result.current).toMatchObject({ sort: 'verdict', dir: 'asc' });
  });
});
