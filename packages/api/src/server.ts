import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './observability/logger.js';
import { startScheduler } from './services/scheduler.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Macronome API listening on :${env.PORT}`);
  // In-process Google Drive backup scheduler (B-208, ADR-0004). Started here, never in
  // createApp(), so it stays inert under the integration tests (which import createApp).
  startScheduler();
});
