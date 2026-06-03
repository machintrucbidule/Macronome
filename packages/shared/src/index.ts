// Public surface of @macronome/shared: domain constants + DTO Zod schemas/types
// + the ErrorCode enum. No runtime/business logic (that is the api's).
export { KCAL_PER_G, KCAL_PER_KG } from './constants/energy.js';
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
