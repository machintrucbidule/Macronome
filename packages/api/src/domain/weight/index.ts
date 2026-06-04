// Pure weight domain — EMA, trajectory, BMI, projection, periods. Consumed by
// services/weight.ts and services/weight-periods.ts; no I/O, no Prisma.
export { deriveEma } from './ema.js';
export { bmi, bmiCategory } from './bmi.js';
export {
  deriveTrajectory,
  ecart,
  type TrajectoryInput,
  type TrajectoryPeriod,
} from './trajectory.js';
export {
  projectGoalDate,
  type ProjectionInput,
  type ProjectionPoint,
  type ProjectionResult,
  type ProjectionStatus,
} from './projection.js';
export { derivePeriods, type RawPeriod, type WeighInInput } from './periods.js';
