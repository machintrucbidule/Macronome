// Activity levels — single source of truth, imported by `api` (to compute burns)
// and `web` (labels/descriptions). No calculation lives here; this holds the five
// canonical keys + their PAL multipliers only.
// Source: spec/logic/00-conventions.md §"Activity levels", DECISIONS.md Gap #11.

/** The five canonical activity keys, sedentary → most active. */
export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
] as const;

/** An activity level key. */
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** PAL multiplier applied to BMR for each level (estimated burn = BMR × multiplier). */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

/** Fallback used when there is no logged-day activity yet (metabolic-engine.md §3). */
export const DEFAULT_ACTIVITY_LEVEL: ActivityLevel = 'sedentary';

/** i18n key suffixes for each level's short label + long description (UI resolves them). */
export const ACTIVITY_LABEL_KEYS: Record<ActivityLevel, { label: string; description: string }> = {
  sedentary: { label: 'activity.sedentary.label', description: 'activity.sedentary.description' },
  lightly_active: {
    label: 'activity.lightly_active.label',
    description: 'activity.lightly_active.description',
  },
  moderately_active: {
    label: 'activity.moderately_active.label',
    description: 'activity.moderately_active.description',
  },
  very_active: {
    label: 'activity.very_active.label',
    description: 'activity.very_active.description',
  },
  extremely_active: {
    label: 'activity.extremely_active.label',
    description: 'activity.extremely_active.description',
  },
};
