import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { connectRabbitMQ } from './events/publisher.js';
import { startConsumer } from './events/consumer.js';
import { stripeWebhook } from './controllers/paymentController.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';

const app = express();

app.use(requestId);

// Stripe webhook MUST come before express.json() — needs raw body
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(stripeWebhook)
);

// JSON parsing for all other routes
app.use(express.json());

// ─── API Docs ───────────────────────────────────────────
app.use('/api/payments/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/payments', paymentRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

app.use(errorHandler);

const start = async (): Promise<void> => {
  try {
    await connectRabbitMQ();
    await startConsumer();

    app.listen(config.port, () => {
      console.log(`Payment service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start payment service:', err);
    process.exit(1);
  }
};

start();
