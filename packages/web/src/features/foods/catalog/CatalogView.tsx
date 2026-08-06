import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodRef } from '@macronome/shared';
import { useIsMobile } from '../../../lib/useIsMobile';
import { CatalogDesktop } from './CatalogDesktop';
import { CatalogMobile } from './CatalogMobile';
import { catalogLocale } from './refName';
import { buildRefListParams, useCatalogFilters } from './useCatalogFilters';
import { useFoodRefGroups, useFoodRefsList } from './useFoodRefs';

// Catalogue Ciqual mode of the Aliments screen (B-292). Owns its own filters and query; the
// search text is the page's, so it survives a mode switch. Renders; never computes.
interface CatalogViewProps {
  /** Shared with Mes aliments — switching mode keeps what the user typed. Drives the FIELD. */
  q: string;
  /** The same text, debounced (LD-1/B-303). Drives the QUERY, so typing does not restart it. */
  queryQ: string;
  onQ: (q: string) => void;
  modeToggle: ReactNode;
  /** Opens the ordinary food form, prefilled from the reference entry. */
  onAdopt: (ref: FoodRef) => void;
  /** The greyed "+ Ajouter un aliment" still needs a handler; it never fires here. */
  onAdd: () => void;
}

export function CatalogView(props: CatalogViewProps) {
  const { i18n } = useTranslation();
  const isMobile = useIsMobile();
  const locale = catalogLocale(i18n.language);
  const filters = useCatalogFilters();
  const params = buildRefListParams(filters.state, props.queryQ, locale);

  const list = useFoodRefsList(params);
  const groups = useFoodRefGroups(locale);

  const common = {
    refs: list.rows,
    loading: list.loading,
    isError: list.isError,
    list,
    total: list.total,
    q: props.q,
    groups: groups.data?.data ?? [],
    ...filters.state,
    modeToggle: props.modeToggle,
    onQ: props.onQ,
    ...filters.handlers,
    onAdd: props.onAdd,
    onAdopt: props.onAdopt,
  };

  return isMobile ? <CatalogMobile {...common} /> : <CatalogDesktop {...common} />;
}
