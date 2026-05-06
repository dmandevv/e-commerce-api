import { createLogger } from '@ecommerce/shared/logger';
import { config } from './config/index.js';
import { connectRabbitMQ } from './events/publisher.js';
import { startConsumer } from './events/consumer.js';
import { app } from './app.js';

const logger = createLogger('payment-service');

const start = async (): Promise<void> => {
  try {
    await connectRabbitMQ();
    await startConsumer();

    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Service started');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
};

start();