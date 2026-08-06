// The version of the bundle currently running, baked at build time (B-286, ADR-0002).
// Its own module so it stays mockable: vitest merges vite.config.ts, which would otherwise
// freeze the injected value at 'dev' for every test. Display-only and non-authoritative —
// /api/v1/health remains the authority for "what is deployed".
export const BUILD_VERSION: string = __APP_VERSION__;

/** 'dev' means an unversioned build (local Vite, e2e): it can never claim to be stale. */
export const IS_DEV_BUILD = BUILD_VERSION === 'dev';
