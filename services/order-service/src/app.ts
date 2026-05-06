import express from 'express';
import swaggerUi from 'swagger-ui-express';
import orderRoutes from './routes/orderRoutes.js';
import swaggerSpec from './swagger.js';
import { requestId, csrfProtection, createRequestLogger, createErrorHandler } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

export const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(requestId);
app.use(createRequestLogger('order-service'));
app.use(metricsMiddleware('order-service'));

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// ─── API Docs ───────────────────────────────────────────
app.use('/api/orders/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/orders', orderRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});
app.get('/metrics', metricsEndpoint);

app.use(createErrorHandler('order-service'));

