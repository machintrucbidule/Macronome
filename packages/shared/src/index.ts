// Public surface of @macronome/shared: domain constants + DTO Zod schemas/types
// + the ErrorCode enum. No runtime/business logic (that is the api's).
export { KCAL_PER_G, KCAL_PER_KG } from './constants/energy.js';
export {
  ACTIVITY_LEVELS,
  ACTIVITY_MULTIPLIERS,
  ACTIVITY_LABEL_KEYS,
  DEFAULT_ACTIVITY_LEVEL,
} from './constants/activity.js';
export type { ActivityLevel } from './constants/activity.js';
export {
  SUGGEST_RANGE_HALF_WIDTH_KCAL,
  RECENT_ACTIVITY_WINDOW_DAYS,
  EMA_ALPHA,
  STATS_ROLLING_WINDOWS,
  BEST_MONTH_MIN_DAYS,
  NOK_RUN_ALERT,
  OK_RATE_GOOD_PCT,
} from './constants/tuning.js';
export {
  RATING_GRADES,
  RATING_LABEL_KEYS,
  UNRATED_DISPLAY,
  passesMinRating,
} from './constants/rating.js';
export type { Rating } from './constants/rating.js';
export { ErrorCode } from './errors.js';
export * from './dto/auth.js';
export * from './dto/food.js';
export * from './dto/recipe.js';
export * from './dto/profile.js';
export * from './dto/target.js';
export * from './dto/day.js';
export * from './dto/weight.js';
export * from './dto/stats.js';
export * from './dto/settings.js';
export * from './dto/container.js';
export * from './dto/meal-template.js';
export * from './dto/pantry.js';
export * from './dto/data.js';
export * from './dto/about.js';
