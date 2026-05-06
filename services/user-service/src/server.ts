import mongoose from 'mongoose';
import { connectRabbitMQ } from './events/publisher.js';
import { app } from './app.js';
import { config } from './config/index.js';

import { createLogger } from '@ecommerce/shared/logger';
const logger = createLogger('user-service');

// ─── Start ──────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected');

    await connectRabbitMQ();

    app.listen(config.port, () => {
      logger.info({port: config.port}, "Service started")
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
};

start();
