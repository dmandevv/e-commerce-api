import mongoose from 'mongoose';
import { config } from './config/index.js';
import { app } from './app.js';
import { startConsumer } from './events/consumer.js';

import { createLogger } from '@ecommerce/shared/logger';
const logger = createLogger('product-service');

// ─── Start ──────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected');

    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Service running');
    });

    await startConsumer();

  } catch (err) {
    logger.error({ err }, 'Failed to start service:');
    process.exit(1);
  }
};

start();