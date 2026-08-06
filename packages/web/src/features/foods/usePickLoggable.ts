import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LoggableItem } from '@macronome/shared';
import { foodsApi } from '../../api/foods';
import { notify } from '../../components/Toast/notify';
import { catalogLocale } from './catalog/refName';
import { FOOD_REFS_KEY } from './catalog/useFoodRefs';

// Picking a result out of a food search (B-293).
//
// A result is either one of the user's own foods — whose id can be used straight away — or a
// Ciqual reference entry, whose id belongs to `food_ref` and is NOT a food id. This hook is the
// single place that difference is resolved: it adopts first when needed, then hands back a real
// food. It exists once rather than three times so the meal, recipe and pantry pickers cannot
// drift apart on the one thing they must agree on.

/** What a picker needs to continue its own gesture, whatever the result was. */
export interface PickedFood {
  id: string;
  named_portions: LoggableItem['named_portions'];
}

export function usePickLoggable() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const locale = catalogLocale(i18n.language);

  const adopt = useMutation({
    mutationFn: (refId: string) => foodsApi.createFromRef({ ref_id: refId, locale }),
    onSuccess: () => {
      // The new food lands in the Aliments list AND in the pantry picker (same key prefix); the
      // catalog's "déjà ajouté" marker moves; and both search hooks must forget their pages.
      void qc.invalidateQueries({ queryKey: ['foods'] });
      void qc.invalidateQueries({ queryKey: FOOD_REFS_KEY });
      void qc.invalidateQueries({ queryKey: ['loggable'] });
      notify('foodAdopted');
    },
  });

  /**
   * Resolve a search hit into a real food, adopting a reference entry on the way.
   * The adopted food carries no named portion, so the caller gets an empty list — which is
   * exactly what a freshly adopted Ciqual entry has.
   */
  const resolve = useCallback(
    async (item: LoggableItem): Promise<PickedFood> => {
      if (item.origin !== 'ciqual_ref') {
        return { id: item.id, named_portions: item.named_portions };
      }
      const res = await adopt.mutateAsync(item.id);
      return { id: res.data.id, named_portions: res.data.named_portions };
    },
    [adopt],
  );

  /**
   * Same resolution, but handing back a whole search item rather than an id — what the recipe
   * ingredient builder needs, since it derives `ref_type` / `ref_id` from the picked item. An
   * adopted entry comes back as `origin:'own'`, because by then it is.
   */
  const resolveItem = useCallback(
    async (item: LoggableItem): Promise<LoggableItem> => {
      if (item.origin !== 'ciqual_ref') return item;
      const picked = await resolve(item);
      return { ...item, id: picked.id, origin: 'own', named_portions: picked.named_portions };
    },
    [resolve],
  );

  return { resolve, resolveItem, adopting: adopt.isPending };
}
