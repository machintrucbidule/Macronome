import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import type { PagedList } from '../../../lib/usePagedList';
import { BulkButton } from '../../../components/BulkEdit';
import type { FoodsBulk } from '../useFoodsBulk';
import { FoodsToolbar } from './FoodsToolbar';
import { FoodTable, type SortField } from './FoodTable';
import { FiltersPopover, type MinRating, type VisibilityFilter } from './FiltersPopover';
import type { SourceFilter } from '../sourceFilter';

// Desktop Aliments view (mobile-responsive S7): the dense table + toolbar extracted verbatim
// from FoodsPage so the page can be a thin useIsMobile() switch. Rendered when useIsMobile()
// is false → byte-identical to the pre-S7 screen.
interface FoodsDesktopProps {
  foods: Food[];
  loading: boolean;
  isError: boolean;
  list: PagedList<Food>;
  /** Rows matching the current filters, server-side (B-278); undefined until page 1 lands. */
  total: number | undefined;
  q: string;
  minRating: MinRating;
  visibility: VisibilityFilter;
  source: SourceFilter;
  /** Chips the Source filter may offer; empty hides the block entirely (B-295). */
  sourceOptions: SourceFilter[];
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
  /** The shared mode switch, rendered under the toolbar (B-292). */
  modeToggle: ReactNode;
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onSource: (s: SourceFilter) => void;
  onShowArchived: (v: boolean) => void;
  onSort: (field: SortField) => void;
  onAdd: () => void;
  onOpen: (food: Food) => void;
  onArchive: (food: Food) => void;
  onRestore: (food: Food) => void;
  /** Batch selection + write (BE-1); `onBulkEdit` is the page's, since at 1 selected it opens the
   *  ordinary food form rather than the batch popup. */
  bulk: FoodsBulk;
  onBulkEdit: () => void;
}

export function FoodsDesktop(props: FoodsDesktopProps) {
  const { t } = useTranslation();
  // B-278: reserve the height of the rows the server has but we have not fetched, and keep pulling
  // pages while the scroll position asks for rows beyond the loaded ones.
  const reserve = useListReserve(props.list);
  return (
    <>
      <FoodsToolbar
        count={props.total}
        countKey="foods.count"
        q={props.q}
        onQ={props.onQ}
        onAdd={props.onAdd}
        bulk={<BulkButton count={props.bulk.selection.count} onClick={props.onBulkEdit} />}
        selectedCount={props.bulk.selection.count}
        filters={
          <FiltersPopover
            minRating={props.minRating}
            visibility={props.visibility}
            source={props.source}
            sourceOptions={props.sourceOptions}
            showArchived={props.showArchived}
            onMinRating={props.onMinRating}
            onVisibility={props.onVisibility}
            onSource={props.onSource}
            onShowArchived={props.onShowArchived}
          />
        }
      />
      {props.modeToggle}

      {props.isError && <Banner tone="warning">{t('common.loadError')}</Banner>}

      {props.loading ? (
        <SkeletonTableRows />
      ) : props.foods.length === 0 ? (
        <EmptyState>{t('foods.empty')}</EmptyState>
      ) : (
        <>
          <FoodTable
            slots={props.list.slots}
            head={props.list.firstPageCount}
            pitch={reserve.pitch}
            sort={props.sort}
            dir={props.dir}
            onSort={props.onSort}
            onOpen={props.onOpen}
            onArchive={props.onArchive}
            onRestore={props.onRestore}
            selection={props.bulk.selection}
            onSelectAll={props.bulk.selectAll}
            total={props.total}
            rowsRef={reserve.listRef}
          />
          <InfiniteScrollFooter loadedCount={props.list.rows.length} />
        </>
      )}
    </>
  );
}
