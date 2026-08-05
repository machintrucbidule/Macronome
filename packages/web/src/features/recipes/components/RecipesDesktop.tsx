import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { RecipesToolbar } from './RecipesToolbar';
import { RecipesTable, type SortField } from './RecipesTable';
import type { MinRating } from './FiltersPopover';

// Recettes desktop view (≥561px): the untouched toolbar + dense 10-column table + lazy-load
// footer, extracted verbatim from RecipesPage so the page stays a thin useIsMobile() switch
// (mobile-responsive S6). The rendered desktop DOM is identical to before this extraction.
interface RecipesDesktopProps {
  recipes: RecipeSummary[];
  loading: boolean;
  list: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
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
}

export function RecipesDesktop(props: RecipesDesktopProps) {
  const { t } = useTranslation();
  return (
    <>
      <RecipesToolbar
        count={props.recipes.length}
        q={props.q}
        minRating={props.minRating}
        showArchived={props.showArchived}
        onQ={props.onQ}
        onMinRating={props.onMinRating}
        onShowArchived={props.onShowArchived}
        onAdd={props.onAdd}
      />

      {props.loading ? (
        <SkeletonTableRows />
      ) : props.recipes.length === 0 ? (
        <EmptyState>{t('recipes.empty')}</EmptyState>
      ) : (
        <>
          <RecipesTable
            recipes={props.recipes}
            sort={props.sort}
            dir={props.dir}
            onSort={props.onSort}
            onOpen={props.onOpen}
            onArchive={props.onArchive}
            onRestore={props.onRestore}
          />
          <InfiniteScrollFooter query={props.list} />
        </>
      )}
    </>
  );
}
