import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './observability/logger.js';
import { seedFoodRefCatalog } from './services/ciqual-seed.js';
import { startScheduler } from './services/scheduler.js';

// Bring the global Ciqual reference catalog in line with the extract shipped in this build
// (B-289) BEFORE serving, so the app never answers from a half-written catalog. It is a
// no-op when the edition already matches. Here rather than in createApp(), for the same
// reason as the scheduler below: the integration tests import createApp and must stay inert.
const seeded = await seedFoodRefCatalog();
logger.info(
  { dataset: seeded.dataset, count: seeded.count, replaced: seeded.replaced },
  seeded.replaced ? 'Ciqual reference catalog seeded' : 'Ciqual reference catalog already current',
);

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Macronome API listening on :${env.PORT}`);
  // In-process Google Drive backup scheduler (B-208, ADR-0004). Started here, never in
  // createApp(), so it stays inert under the integration tests (which import createApp).
  startScheduler();
});
