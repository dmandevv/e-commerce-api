import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { connectRabbitMQ } from './events/publisher.js';
import { startConsumer } from './events/consumer.js';
import orderRoutes from './routes/orderRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';

const app = express();

app.use(requestId);
app.use(express.json());

// ─── API Docs ───────────────────────────────────────────
app.use('/api/orders/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/orders', orderRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

app.use(errorHandler);

const start = async (): Promise<void> => {
  try {
    await connectRabbitMQ();
    await startConsumer();

    app.listen(config.port, () => {
      console.log(`Order service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start order service:', err);
    process.exit(1);
  }
};

start();
