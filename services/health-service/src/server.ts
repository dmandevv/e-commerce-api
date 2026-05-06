import { createLogger } from '@ecommerce/shared/logger';
import { config } from './config/index.js';
import { app } from './app.js';

const logger = createLogger('health-service');

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Service started');
});