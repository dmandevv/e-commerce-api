import express from 'express';
import swaggerUi from 'swagger-ui-express';
import paymentRoutes from './routes/paymentRoutes.js';
import { stripeWebhook } from './controllers/paymentController.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

export const app = express();

app.use(requestId);
app.use(metricsMiddleware('payment-service'));

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
app.get('/metrics', metricsEndpoint);

app.use(errorHandler);
