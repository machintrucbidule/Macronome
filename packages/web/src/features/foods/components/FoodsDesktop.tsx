import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import { FoodsToolbar } from './FoodsToolbar';
import { FoodTable, type SortField } from './FoodTable';
import type { MinRating, VisibilityFilter } from './FiltersPopover';

// Desktop Aliments view (mobile-responsive S7): the dense table + toolbar extracted verbatim
// from FoodsPage so the page can be a thin useIsMobile() switch. Rendered when useIsMobile()
// is false → byte-identical to the pre-S7 screen.
interface FoodsDesktopProps {
  foods: Food[];
  loading: boolean;
  isError: boolean;
  list: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  /** Rows matching the current filters, server-side (B-278); undefined until page 1 lands. */
  total: number | undefined;
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
  onArchive: (food: Food) => void;
  onRestore: (food: Food) => void;
}

export function FoodsDesktop(props: FoodsDesktopProps) {
  const { t } = useTranslation();
  // B-278: reserve the height of the rows the server has but we have not fetched, and keep pulling
  // pages while the scroll position asks for rows beyond the loaded ones.
  const reserve = useListReserve(props.foods.length, props.total, props.list);
  return (
    <>
      <FoodsToolbar
        count={props.total}
        q={props.q}
        minRating={props.minRating}
        visibility={props.visibility}
        showArchived={props.showArchived}
        onQ={props.onQ}
        onMinRating={props.onMinRating}
        onVisibility={props.onVisibility}
        onShowArchived={props.onShowArchived}
        onAdd={props.onAdd}
      />

      {props.isError && <Banner tone="warning">{t('common.loadError')}</Banner>}

      {props.loading ? (
        <SkeletonTableRows />
      ) : props.foods.length === 0 ? (
        <EmptyState>{t('foods.empty')}</EmptyState>
      ) : (
        <>
          <FoodTable
            foods={props.foods}
            sort={props.sort}
            dir={props.dir}
            onSort={props.onSort}
            onOpen={props.onOpen}
            onArchive={props.onArchive}
            onRestore={props.onRestore}
            rowsRef={reserve.listRef}
          />
          <InfiniteScrollFooter query={props.list} padBottom={reserve.padBottom} />
        </>
      )}
    </>
  );
}
