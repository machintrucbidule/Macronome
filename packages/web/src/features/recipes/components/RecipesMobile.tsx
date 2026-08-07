import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
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
import { BulkIconButton } from '../../../components/BulkEdit';
import { Fab } from '../../../app/Fab';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import type { PagedList } from '../../../lib/usePagedList';
import type { RecipesBulk } from '../useRecipesBulk';
import { RecipeCards } from './RecipeCards';
import { SORT_KEYS, SORT_LABEL, type SortField } from './RecipesTable';
import type { MinRating } from './FiltersPopover';

// Recettes mobile view (mobile-responsive S6, mockups/03-recipes.html / spec §4.3): the phone
// presentation rendered when useIsMobile() is true. The app bar already shows the "Recettes"
// title (S3); this adds a sticky toolbar (search + Trier + Filtres via the shared list chrome),
// the card list, a FAB to add, and the same infinite-scroll footer as the desktop list.
// Filtering and sorting are server-side (the page owns q/minRating/showArchived/sort/dir and
// feeds the query), so this component drives that same state and never re-filters client-side.
// Tapping a card or the FAB opens the bottom-sheet builder. Desktop is untouched (never mounts
// ≥561px; the page renders the dense RecipesTable instead).
interface RecipesMobileProps {
  recipes: RecipeSummary[];
  loading: boolean;
  // Structural subset of the useInfiniteQuery result the footer needs (decoupled from the hook).
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
  /** Batch selection + write (BE-1/B-308); at 1 selected `onBulkEdit` opens the ordinary sheet. */
  bulk: RecipesBulk;
  onBulkEdit: () => void;
}

/** The card list's own `gap: var(--sp-5)`, which a measured container excludes (B-278). */
const CARD_GAP = 10;

export function RecipesMobile(props: RecipesMobileProps) {
  const { t } = useTranslation();
  // B-278: reserve the unloaded rows' height and chain pages when the scroll asks for them.
  const reserve = useListReserve(props.list, CARD_GAP);

  // The server-sortable columns, from the desktop table's own list so the two cannot drift.
  const sortOptions: SortOption<SortField>[] = SORT_KEYS.map((key) => ({
    key,
    label: t(`recipes.col.${SORT_LABEL[key]}`),
  }));

  // The desktop FiltersPopover controls, in one bottom sheet: min-rating chips + show-archived.
  const ratings: MinRating[] = [0, 1, 2, 3];
  const filterSections: FilterSection[] = [
    {
      kind: 'chips',
      label: t('recipes.filters.minRating'),
      value: String(props.minRating),
      options: ratings.map((r) => ({
        key: String(r),
        label: r === 0 ? t('recipes.filters.all') : `≥${r}★`,
      })),
      onChange: (k) => props.onMinRating(Number(k) as MinRating),
    },
    {
      kind: 'toggle',
      label: t('recipes.filters.showArchived'),
      checked: props.showArchived,
      onChange: props.onShowArchived,
    },
  ];
  const filtersActive = props.minRating > 0 || props.showArchived;

  // Loading → empty → cards, mirroring the desktop page switch (no nested ternary).
  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.recipes.length === 0) return <EmptyState>{t('recipes.empty')}</EmptyState>;
    return (
      <>
        <RecipeCards
          slots={props.list.slots}
          head={props.list.firstPageCount}
          pitch={reserve.pitch}
          onOpen={props.onOpen}
          selection={props.bulk.selection}
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
            placeholder={t('recipes.searchPlaceholder')}
            onChange={(e) => props.onQ(e.target.value)}
          />
        }
      >
        {/* Batch edit (BE-1, owner follow-up): an icon-only chrome control, first in the trailing
            group — left of Trier — shown only once something is ticked; see FoodsMobile. */}
        {props.bulk.selection.count > 0 && <BulkIconButton onClick={props.onBulkEdit} />}
        <SortSheet
          options={sortOptions}
          sort={props.sort}
          dir={props.dir}
          onSort={props.onSort}
          fabSafe
        />
        <FiltersSheet sections={filterSections} active={filtersActive} fabSafe />
      </ListToolbar>

      {body}

      <Fab onClick={props.onAdd} label={t('recipes.add')} />
    </>
  );
}
