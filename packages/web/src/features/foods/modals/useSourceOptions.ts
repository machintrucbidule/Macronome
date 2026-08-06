import { useTranslation } from 'react-i18next';
import type { CreateFoodSource, FoodSource } from '@macronome/shared';
import { useSettingsQuery } from '../../settings/useSettings';

// Which provenances the food form may offer (B-295).
//
// `manual` and `ciqual` are always offered: typing is always possible, and the Ciqual catalog
// ships inside the image, so tagging a hand-copied entry as Ciqual always makes sense.
//
// `chronodrive` is offered only when it can mean something — either a food already carries it
// (so the value must stay selectable, even if the integration was removed since), or the
// Chronodrive gateway is configured (so one can be created). The gateway flag is the very same
// signal ChronoSearchLink uses to show the search link.

const ALWAYS: CreateFoodSource[] = ['manual', 'ciqual'];

export interface SourceOption {
  value: CreateFoodSource;
  label: string;
}

/**
 * @param presentSources provenances present in the user's catalog, from `GET /foods`.
 * @param current the draft's own provenance — always offered, so a food never silently loses it.
 */
export function useSourceOptions(
  presentSources: FoodSource[],
  current: CreateFoodSource,
): SourceOption[] {
  const { t } = useTranslation();
  const gateway = useSettingsQuery().data?.data.integrations.barclaude_gateway ?? null;
  const chronoUsable =
    gateway !== null || presentSources.includes('chronodrive') || current === 'chronodrive';
  const values: CreateFoodSource[] = chronoUsable ? [...ALWAYS, 'chronodrive'] : ALWAYS;
  return values.map((value) => ({ value, label: t(`foods.source.${value}`) }));
}
