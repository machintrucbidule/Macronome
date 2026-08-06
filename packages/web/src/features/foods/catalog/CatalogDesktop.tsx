import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodRef } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import { FoodsToolbar } from '../components/FoodsToolbar';
import { CatalogFilters } from './CatalogFilters';
import { CatalogTable } from './CatalogTable';
import type { CatalogSortField } from './useCatalogFilters';

// Desktop Catalogue Ciqual view (B-292) — the same frame as FoodsDesktop, over reference
// entries instead of the user's foods. "+ Ajouter un aliment" is greyed here: in the catalog,
// adding happens per row.
export interface CatalogViewProps {
  refs: FoodRef[];
  loading: boolean;
  isError: boolean;
  list: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  total: number | undefined;
  q: string;
  group: string;
  groups: string[];
  sort: CatalogSortField;
  dir: 'asc' | 'desc';
  modeToggle: ReactNode;
  onQ: (q: string) => void;
  onGroup: (group: string) => void;
  onSort: (field: CatalogSortField) => void;
  onAdd: () => void;
  onAdopt: (ref: FoodRef) => void;
}

export function CatalogDesktop(props: CatalogViewProps) {
  const { t } = useTranslation();
  const reserve = useListReserve(props.refs.length, props.total, props.list);
  return (
    <>
      <FoodsToolbar
        count={props.total}
        countKey="foods.catalog.count"
        q={props.q}
        onQ={props.onQ}
        onAdd={props.onAdd}
        addDisabled
        filters={
          <CatalogFilters group={props.group} groups={props.groups} onGroup={props.onGroup} />
        }
      />
      {props.modeToggle}

      {props.isError && <Banner tone="warning">{t('common.loadError')}</Banner>}

      {props.loading ? (
        <SkeletonTableRows />
      ) : props.refs.length === 0 ? (
        <EmptyState>{t('foods.catalog.empty')}</EmptyState>
      ) : (
        <>
          <CatalogTable
            refs={props.refs}
            sort={props.sort}
            dir={props.dir}
            onSort={props.onSort}
            onAdopt={props.onAdopt}
            rowsRef={reserve.listRef}
          />
          <InfiniteScrollFooter query={props.list} {...reserve.footer} />
        </>
      )}
    </>
  );
}
