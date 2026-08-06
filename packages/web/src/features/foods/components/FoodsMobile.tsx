import { type ReactNode } from 'react';
import type { TFunction } from 'i18next';
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
import { useListReserve } from '../../../lib/useListReserve';
import { FoodCards } from './FoodCards';
import type { SortField } from './FoodTable';
import type { MinRating, VisibilityFilter } from './FiltersPopover';
import type { SourceFilter } from '../sourceFilter';

// Mobile Aliments view (mobile-responsive S7, spec §4.3 — same pattern as Recettes S6).
// Sticky list chrome (search + Trier + Filtres) over a card list, with a FAB that opens the
// bottom-sheet add form. Consumes the shared ListChrome read-only; no shared file is edited.
interface FoodsMobileProps {
  foods: Food[];
  loading: boolean;
  isError: boolean;
  list: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  /** Rows matching the current filters, server-side (B-278); undefined until page 1 lands. */
  total: number | undefined;
  q: string;
  minRating: MinRating;
  visibility: VisibilityFilter;
  source: SourceFilter;
  /** Chips the Source filter may offer; empty hides the section entirely (B-295). */
  sourceOptions: SourceFilter[];
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onSource: (s: SourceFilter) => void;
  onShowArchived: (v: boolean) => void;
  onSort: (field: SortField) => void;
  onAdd: () => void;
  onOpen: (food: Food) => void;
}

/** The card list's own `gap: var(--sp-5)`, which a measured container excludes (B-278). */
const CARD_GAP = 10;

const SORT_KEYS: SortField[] = [
  'name',
  'kcal',
  'fat',
  'carb',
  'protein',
  'rating',
  'source',
  'visibility',
  'usage',
];

/** The Trier sheet mirrors the desktop table's sortable headers, in column order. */
function buildSortOptions(t: TFunction): SortOption<SortField>[] {
  return SORT_KEYS.map((key) => ({ key, label: t(`foods.col.${key}`) }));
}

/** The Filtres sheet mirrors the desktop popover, section for section. */
function buildFilterSections(props: FoodsMobileProps, t: TFunction): FilterSection[] {
  const ratings: MinRating[] = [0, 1, 2, 3];
  const visibilities: VisibilityFilter[] = ['all', 'private', 'shared'];
  return [
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
    // Same rule as the desktop popover: no Source section below two provenances present (B-295).
    ...(props.sourceOptions.length > 0
      ? [
          {
            kind: 'chips' as const,
            label: t('foods.filters.source'),
            value: props.source,
            options: props.sourceOptions.map((s) => ({ key: s, label: t(`foods.source.${s}`) })),
            onChange: (k: string) => props.onSource(k as SourceFilter),
          },
        ]
      : []),
    {
      kind: 'toggle',
      label: t('foods.filters.showArchived'),
      checked: props.showArchived,
      onChange: props.onShowArchived,
    },
  ];
}

export function FoodsMobile(props: FoodsMobileProps) {
  const { t } = useTranslation();
  // B-278: reserve the unloaded rows' height and chain pages when the scroll asks for them.
  const reserve = useListReserve(props.foods.length, props.total, props.list, CARD_GAP);

  const sortOptions = buildSortOptions(t);
  const filterSections = buildFilterSections(props, t);
  const filtersActive =
    props.minRating > 0 ||
    props.visibility !== 'all' ||
    props.source !== 'all' ||
    props.showArchived;

  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.foods.length === 0) return <EmptyState>{t('foods.empty')}</EmptyState>;
    return (
      <>
        <FoodCards foods={props.foods} onOpen={props.onOpen} rowsRef={reserve.listRef} />
        <InfiniteScrollFooter query={props.list} {...reserve.footer} />
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
