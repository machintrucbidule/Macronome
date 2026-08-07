import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import type { PagedList } from '../../../lib/usePagedList';
import { BulkButton } from '../../../components/BulkEdit';
import type { RecipesBulk } from '../useRecipesBulk';
import { RecipesToolbar } from './RecipesToolbar';
import { RecipesTable, type SortField } from './RecipesTable';
import type { MinRating } from './FiltersPopover';

// Recettes desktop view (≥561px): the untouched toolbar + dense 10-column table + lazy-load
// footer, extracted verbatim from RecipesPage so the page stays a thin useIsMobile() switch
// (mobile-responsive S6). The rendered desktop DOM is identical to before this extraction.
interface RecipesDesktopProps {
  recipes: RecipeSummary[];
  loading: boolean;
  list: PagedList<RecipeSummary>;
  /** Rows matching the current filters, server-side (B-278); undefined until page 1 lands. */
  total: number | undefined;
  q: string;
  minRating: MinRating;
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onShowArchived: (v: boolean) => void;
  onSort: (field: SortField) => void;
  onAdd: () => void;
  onOpen: (recipe: RecipeSummary) => void;
  onArchive: (recipe: RecipeSummary) => void;
  onRestore: (recipe: RecipeSummary) => void;
  /** Batch selection + write (BE-1/B-308); at 1 selected `onBulkEdit` opens the ordinary builder. */
  bulk: RecipesBulk;
  onBulkEdit: () => void;
}

export function RecipesDesktop(props: RecipesDesktopProps) {
  const { t } = useTranslation();
  // B-278: reserve the unloaded rows' height and chain pages when the scroll asks for them.
  const reserve = useListReserve(props.list);
  return (
    <>
      <RecipesToolbar
        count={props.total}
        q={props.q}
        minRating={props.minRating}
        showArchived={props.showArchived}
        onQ={props.onQ}
        onMinRating={props.onMinRating}
        onShowArchived={props.onShowArchived}
        onAdd={props.onAdd}
        bulk={<BulkButton count={props.bulk.selection.count} onClick={props.onBulkEdit} />}
        selectedCount={props.bulk.selection.count}
      />

      {props.loading ? (
        <SkeletonTableRows />
      ) : props.recipes.length === 0 ? (
        <EmptyState>{t('recipes.empty')}</EmptyState>
      ) : (
        <>
          <RecipesTable
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
