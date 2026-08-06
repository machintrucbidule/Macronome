import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { loggableSearchApi } from '../../api/loggableSearch';
import { catalogLocale } from '../foods/catalog/refName';

// Food search for the garde-manger editor (to pick a food to pin). Pinned-chip names are
// resolved per id via useFood in PantryFoodChip (the Repas pattern), so there is no capped
// foods "index" here — every pinned food is named regardless of catalog size (B-102).
// Ordered most-used-first over the 90-day window (FU-1/B-151), like the other pickers.
//
// B-293: this used to query `GET /foods`, which made it the only picker of the three without
// recipes and — once the catalog shipped — without Ciqual either. It now uses the same
// `/search/loggable` as the Repas and recipe pickers, so all three offer the same things. A
// recipe was already pinnable through the Repas 📌 (a pin points at the recipe's derived food and
// nothing filters it server-side); this simply opens the second door too.

export function useFoodSearch(q: string, enabled: boolean) {
  const { i18n } = useTranslation();
  const locale = catalogLocale(i18n.language);
  return useQuery({
    queryKey: ['loggable', 'pantry', q, locale],
    queryFn: () => loggableSearchApi.search(q.trim() || undefined, locale),
    enabled,
  });
}
