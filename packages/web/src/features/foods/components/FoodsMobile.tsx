import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { SearchField } from '../../../components/Form/SearchField';
import {
  FiltersSheet,
  ListToolbar,
  SortSheet,
  type FilterSection,
  type SortOption,
} from '../../../components/ListChrome';
import { Fab } from '../../../app/Fab';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { FoodCards } from './FoodCards';
import type { SortField } from './FoodTable';
import type { MinRating, VisibilityFilter } from './FiltersPopover';

// Mobile Aliments view (mobile-responsive S7, spec §4.3 — same pattern as Recettes S6).
// Sticky list chrome (search + Trier + Filtres) over a card list, with a FAB that opens the
// full-screen add sheet. Consumes the shared ListChrome read-only; no shared file is edited.
interface FoodsMobileProps {
  foods: Food[];
  loading: boolean;
  isError: boolean;
  list: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  q: string;
  minRating: MinRating;
  visibility: VisibilityFilter;
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onShowArchived: (v: boolean) => void;
  onSort: (field: SortField) => void;
  onAdd: () => void;
  onOpen: (food: Food) => void;
}

export function FoodsMobile(props: FoodsMobileProps) {
  const { t } = useTranslation();

  const sortOptions: SortOption<SortField>[] = [
    { key: 'name', label: t('foods.col.name') },
    { key: 'kcal', label: t('foods.col.kcal') },
    { key: 'fat', label: t('foods.col.fat') },
    { key: 'carb', label: t('foods.col.carb') },
    { key: 'protein', label: t('foods.col.protein') },
    { key: 'rating', label: t('foods.col.rating') },
    { key: 'visibility', label: t('foods.col.visibility') },
  ];

  const ratings: MinRating[] = [0, 1, 2, 3];
  const visibilities: VisibilityFilter[] = ['all', 'private', 'shared'];
  const filterSections: FilterSection[] = [
    {
      kind: 'chips',
      label: t('foods.filters.minRating'),
      value: String(props.minRating),
      options: ratings.map((r) => ({
        key: String(r),
        label: r === 0 ? t('foods.filters.all') : `≥${r}★`,
      })),
      onChange: (k) => props.onMinRating(Number(k) as MinRating),
    },
    {
      kind: 'chips',
      label: t('foods.filters.visibility'),
      value: props.visibility,
      options: visibilities.map((v) => ({ key: v, label: t(`foods.visibility.${v}`) })),
      onChange: (k) => props.onVisibility(k as VisibilityFilter),
    },
    {
      kind: 'toggle',
      label: t('foods.filters.showArchived'),
      checked: props.showArchived,
      onChange: props.onShowArchived,
    },
  ];
  const filtersActive = props.minRating > 0 || props.visibility !== 'all' || props.showArchived;

  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.foods.length === 0) return <EmptyState>{t('foods.empty')}</EmptyState>;
    return (
      <>
        <FoodCards foods={props.foods} onOpen={props.onOpen} />
        <InfiniteScrollFooter query={props.list} />
      </>
    );
  })();

  return (
    <>
      <ListToolbar
        leading={
          <SearchField
            value={props.q}
            placeholder={t('foods.searchPlaceholder')}
            onChange={(e) => props.onQ(e.target.value)}
          />
        }
      >
        <SortSheet
          options={sortOptions}
          sort={props.sort}
          dir={props.dir}
          onSort={props.onSort}
          fabSafe
        />
        <FiltersSheet sections={filterSections} active={filtersActive} fabSafe />
      </ListToolbar>

      {props.isError && <Banner tone="warning">{t('common.loadError')}</Banner>}

      {body}

      <Fab onClick={props.onAdd} label={t('foods.add')} />
    </>
  );
}
