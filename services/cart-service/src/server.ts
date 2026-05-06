import { createLogger } from '@ecommerce/shared/logger';
import { config } from './config/index.js';
import { cartRepository } from './repositories/cartRepository.js';
import { app } from './app.js';

const logger = createLogger('cart-service');

const start = async (): Promise<void> => {
  try {
    await cartRepository.connect();

    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Service started');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
};

start();