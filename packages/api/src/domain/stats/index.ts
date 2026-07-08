// Stats & adherence domain — pure functions (spec/logic/stats-adherence.md). Operate on
// already-logged DayStat[] (the service filters not-logged days out). No DB, no I/O.
export { mean, okRate, vsTarget, addDays, latestDate, type DayStat } from './util.js';
export { rolling, windowStats, inWindow, type WindowStats } from './rolling.js';
export { heatmap } from './heatmap.js';
export { monthlyPivot } from './monthly.js';
export { zoneAsOf, monthEndDate, type TargetBand } from './monthly-zones.js';
export { currentOkStreak, currentNokRun } from './streak.js';
export { bestMonth } from './best-month.js';
export { signals } from './signals.js';
export { weightRecords, type WeightSample } from './records.js';
