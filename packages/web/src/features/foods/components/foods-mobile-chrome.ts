import type { TFunction } from 'i18next';
import type { FilterSection, SortOption } from '../../../components/ListChrome';
import type { SortField } from './FoodTable';
import type { MinRating, VisibilityFilter } from './FiltersPopover';
import type { SourceFilter } from '../sourceFilter';

// The mobile Trier/Filtres sheet contents for Aliments. Extracted from `FoodsMobile.tsx` by BE-1,
// which added a batch control to that component: the two builders are data, not view, and moving
// them keeps the component inside the file cap.

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
export function buildSortOptions(t: TFunction): SortOption<SortField>[] {
  return SORT_KEYS.map((key) => ({ key, label: t(`foods.col.${key}`) }));
}

/** What the Filtres sheet needs — the same values the desktop popover reads. */
export interface FoodsFilterProps {
  minRating: MinRating;
  visibility: VisibilityFilter;
  source: SourceFilter;
  sourceOptions: SourceFilter[];
  showArchived: boolean;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onSource: (s: SourceFilter) => void;
  onShowArchived: (v: boolean) => void;
}

/** The Filtres sheet mirrors the desktop popover, section for section. */
export function buildFilterSections(props: FoodsFilterProps, t: TFunction): FilterSection[] {
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

/** Whether the Filtres control shows its "active" marker. */
export function filtersActive(props: FoodsFilterProps): boolean {
  return (
    props.minRating > 0 ||
    props.visibility !== 'all' ||
    props.source !== 'all' ||
    props.showArchived
  );
}
