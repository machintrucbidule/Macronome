// Day verdict + snapshot domain — pure functions (spec/logic/day-snapshot-verdict.md).
export {
  dayKcal,
  calorieStatus,
  autoVerdict,
  effectiveVerdict,
  type Verdict,
  type CalorieStatus,
} from './verdict.js';
export {
  resolveSnapshot,
  type SnapshotTarget,
  type SnapshotInputs,
  type ResolvedSnapshot,
} from './snapshot.js';
export { dayState, isLoggedDay, type DayState, type DayStateInputs } from './state.js';
