import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './observability/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Macronome API listening on :${env.PORT}`);
});
