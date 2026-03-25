import express from 'express';
import { config } from './config/index.js';
import { initEmailService } from './services/emailService.js';
import { startConsumer } from './events/consumer.js';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

const app = express();

app.use(metricsMiddleware('notification-service'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});
app.get('/metrics', metricsEndpoint);

const start = async (): Promise<void> => {
  try {
    initEmailService();
    await startConsumer();

    app.listen(config.port, () => {
      console.log(`Notification service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start notification service:', err);
    process.exit(1);
  }
};

start();
