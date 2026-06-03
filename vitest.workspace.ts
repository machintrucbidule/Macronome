// Vitest workspace: `vitest run` at the root runs each package's unit suite
// (its own vitest.config). API integration tests are a separate config
// (packages/api/vitest.integration.config.ts), run via `npm run test:int`.
export default ['packages/shared', 'packages/api', 'packages/web'];
