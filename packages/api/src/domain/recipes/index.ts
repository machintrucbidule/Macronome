// Pure recipe domain (spec/logic/recipes-derived-food.md). Aggregation, derivation and
// the transitive cycle guard — no DB, no request. The service composes these.
export * from './aggregate.js';
export * from './derive.js';
export * from './cycle.js';
