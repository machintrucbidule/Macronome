import {
  RATING_LABEL_KEYS,
  type CreateFoodSource,
  type Food,
  type FoodBulkPatch,
} from '@macronome/shared';
import { bulkRatingValue, type BulkChange, type BulkRatingKey } from '../../../components/BulkEdit';

// The batch form's state and what it becomes on the wire (BE-1). Pure — no React — so the rule
// that matters most is directly testable: **a field left on « Ne pas modifier » is ABSENT from the
// request**, not sent as null or as its current value.

/** `keep` is the default of every control: leave each selected food's own value alone. */
export const KEEP = 'keep';

export type KeepOr<T extends string> = typeof KEEP | T;

export interface FoodBulkDraft {
  rating: BulkRatingKey;
  /** `recipe` is server-owned, so the batch form offers the same restricted set as the food form. */
  source: KeepOr<CreateFoodSource>;
  visibility: KeepOr<Food['visibility']>;
  aiProposable: KeepOr<'yes' | 'no'>;
  /** `set` replaces the comment with `text`; `clear` erases it (sends `null`). */
  comment: KeepOr<'set' | 'clear'>;
  commentText: string;
}

export const emptyBulkDraft: FoodBulkDraft = {
  rating: KEEP,
  source: KEEP,
  visibility: KEEP,
  aiProposable: KEEP,
  comment: KEEP,
  commentText: '',
};

/** The request body's `patch`. Only the fields the user actually set appear in it. */
export function draftToPatch(d: FoodBulkDraft): FoodBulkPatch {
  const rating = bulkRatingValue(d.rating);
  return {
    ...(rating !== undefined ? { rating } : {}),
    ...(d.source !== KEEP ? { source: d.source } : {}),
    ...(d.visibility !== KEEP ? { visibility: d.visibility } : {}),
    ...(d.aiProposable !== KEEP ? { ai_proposable: d.aiProposable === 'yes' } : {}),
    ...(d.comment === 'clear' ? { comment: null } : {}),
    ...(d.comment === 'set' ? { comment: d.commentText } : {}),
  };
}

/** Nothing to apply — the Appliquer button stays disabled, and the API would answer 422 anyway. */
export function isEmptyDraft(d: FoodBulkDraft): boolean {
  return Object.keys(draftToPatch(d)).length === 0;
}

/** The recap lines, in the form's own order. Values are already-translated labels. */
export function draftChanges(d: FoodBulkDraft, t: (key: string) => string): BulkChange[] {
  const patch = draftToPatch(d);
  const out: BulkChange[] = [];
  if (patch.rating !== undefined)
    out.push({
      label: t('foods.field.rating'),
      value: patch.rating === null ? t('rating.unrated') : t(RATING_LABEL_KEYS[patch.rating]),
    });
  if (patch.source !== undefined)
    out.push({ label: t('foods.field.source'), value: t(`foods.source.${patch.source}`) });
  if (patch.visibility !== undefined)
    out.push({
      label: t('foods.field.visibility'),
      value: t(`foods.visibility.${patch.visibility}`),
    });
  if (patch.ai_proposable !== undefined)
    out.push({
      label: t('foods.field.aiProposable'),
      value: t(patch.ai_proposable ? 'common.yes' : 'common.no'),
    });
  if (patch.comment !== undefined)
    out.push({
      label: t('foods.field.comment'),
      value:
        patch.comment === null || patch.comment === '' ? t('bulk.comment.cleared') : patch.comment,
    });
  return out;
}
