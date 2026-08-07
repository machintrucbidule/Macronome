import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { SearchField } from '../../../components/Form/SearchField';
import { FiltersSheet, ListToolbar, SortSheet } from '../../../components/ListChrome';
import { BulkButton } from '../../../components/BulkEdit';
import { Fab } from '../../../app/Fab';
import { InfiniteScrollFooter } from '../../../lib/InfiniteScrollFooter';
import { useListReserve } from '../../../lib/useListReserve';
import type { PagedList } from '../../../lib/usePagedList';
import type { FoodsBulk } from '../useFoodsBulk';
import { FoodCards } from './FoodCards';
import type { SortField } from './FoodTable';
import type { MinRating, VisibilityFilter } from './FiltersPopover';
import type { SourceFilter } from '../sourceFilter';
import { buildFilterSections, buildSortOptions, filtersActive } from './foods-mobile-chrome';
import styles from '../foods-mobile.module.css';

// Mobile Aliments view (mobile-responsive S7, spec §4.3 — same pattern as Recettes S6).
// Sticky list chrome (search + Trier + Filtres) over a card list, with a FAB that opens the
// bottom-sheet add form. Consumes the shared ListChrome read-only; no shared file is edited.
interface FoodsMobileProps {
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
  /** Chips the Source filter may offer; empty hides the section entirely (B-295). */
  sourceOptions: SourceFilter[];
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
  /** The shared mode switch, rendered under the sticky toolbar (B-292). */
  modeToggle: ReactNode;
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onSource: (s: SourceFilter) => void;
  onShowArchived: (v: boolean) => void;
  onSort: (field: SortField) => void;
  onAdd: () => void;
  onOpen: (food: Food) => void;
  /** Batch selection + write (BE-1); `onBulkEdit` is the page's — at 1 selected it opens the
   *  ordinary food sheet rather than the batch one. */
  bulk: FoodsBulk;
  onBulkEdit: () => void;
}

/** The card list's own `gap: var(--sp-5)`, which a measured container excludes (B-278). */
const CARD_GAP = 10;

export function FoodsMobile(props: FoodsMobileProps) {
  const { t } = useTranslation();
  // B-278: reserve the unloaded rows' height and chain pages when the scroll asks for them.
  const reserve = useListReserve(props.list, CARD_GAP);

  const sortOptions = buildSortOptions(t);
  const filterSections = buildFilterSections(props, t);

  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.foods.length === 0) return <EmptyState>{t('foods.empty')}</EmptyState>;
    return (
      <>
        <FoodCards
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
        <FiltersSheet sections={filterSections} active={filtersActive(props)} fabSafe />
      </ListToolbar>

      {/* Batch selection (BE-1/D14): the boxes live on the cards, so the toolbar only needs the
          count and the button. Hidden entirely at zero, to keep the phone list quiet. */}
      {props.bulk.selection.count > 0 && (
        <div className={styles.bulkBar}>
          <BulkButton count={props.bulk.selection.count} onClick={props.onBulkEdit} />
        </div>
      )}

      {props.modeToggle}

      {props.isError && <Banner tone="warning">{t('common.loadError')}</Banner>}

      {body}

      <Fab onClick={props.onAdd} label={t('foods.add')} />
    </>
  );
}
