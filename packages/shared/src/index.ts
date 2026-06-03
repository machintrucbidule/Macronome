// Public surface of @macronome/shared: domain constants + DTO Zod schemas/types
// + the ErrorCode enum. No runtime/business logic (that is the api's).
export { KCAL_PER_G, KCAL_PER_KG } from './constants/energy.js';
export { ErrorCode } from './errors.js';
export * from './dto/auth.js';
