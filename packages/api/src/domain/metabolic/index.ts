// Metabolic engine — pure functions consumed by services/targets.ts (and later M3/M4).
export { ageYears } from './age.js';
export { mifflinStJeor, type BmrInput } from './bmr.js';
export { estimatedBurn, empiricalBurnPerDay, type EmpiricalBurnInput } from './burn.js';
export { deficitPerDay, kgPerWeek, calorieMidpoint, deficitAtTarget } from './deficit.js';
export { recentAvgActivity, type RecentActivity } from './activity.js';
