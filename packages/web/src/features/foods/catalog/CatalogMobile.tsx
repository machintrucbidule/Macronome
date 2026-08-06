import { type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
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
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import { CatalogCards } from './CatalogCards';
import type { CatalogViewProps } from './CatalogDesktop';
import type { CatalogSortField } from './useCatalogFilters';

// Mobile Catalogue Ciqual view (B-292) — the shared list chrome over reference cards, mirroring
// FoodsMobile. No FAB: in the catalog, adding is per card.

/** The card list's own `gap: var(--sp-5)`, which a measured container excludes (B-278). */
const CARD_GAP = 10;

const SORT_KEYS: CatalogSortField[] = ['name', 'kcal', 'fat', 'carb', 'protein'];

function buildSortOptions(t: TFunction): SortOption<CatalogSortField>[] {
  return SORT_KEYS.map((key) => ({ key, label: t(`foods.col.${key}`) }));
}

/** The group filter is a chip group here, not the desktop dropdown: the bottom sheet is
 *  full-width and scrolls, and every other mobile filter on this screen is chips. */
function buildFilterSections(props: CatalogViewProps, t: TFunction): FilterSection[] {
  return [
    {
      kind: 'chips',
      label: t('foods.filters.group'),
      value: props.group,
      options: [
        { key: '', label: t('foods.catalog.allGroups') },
        ...props.groups.map((g) => ({ key: g, label: g })),
      ],
      onChange: props.onGroup,
    },
  ];
}

export function CatalogMobile(props: CatalogViewProps) {
  const { t } = useTranslation();
  const reserve = useListReserve(props.list, CARD_GAP);

  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.refs.length === 0) return <EmptyState>{t('foods.catalog.empty')}</EmptyState>;
    return (
      <>
        <CatalogCards
          slots={props.list.slots}
          head={props.list.firstPageCount}
          pitch={reserve.pitch}
          onAdopt={props.onAdopt}
          rowsRef={reserve.listRef}
        />
        <InfiniteScrollFooter loadedCount={props.list.rows.length} />
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
          options={buildSortOptions(t)}
          sort={props.sort}
          dir={props.dir}
          onSort={props.onSort}
        />
        <FiltersSheet sections={buildFilterSections(props, t)} active={props.group !== ''} />
      </ListToolbar>

      {props.modeToggle}

      {props.isError && <Banner tone="warning">{t('common.loadError')}</Banner>}

      {body}
    </>
  );
}
