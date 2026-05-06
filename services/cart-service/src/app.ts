import express from 'express';
import swaggerUi from 'swagger-ui-express';
import cartRoutes from './routes/cartRoutes.js';
import { createErrorHandler } from '@ecommerce/shared/middleware';
import swaggerSpec from './swagger.js';
import { requestId, csrfProtection, createRequestLogger } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

export const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(requestId);
app.use(createRequestLogger('cart-service'));
app.use(metricsMiddleware('cart-service'));

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// ─── API Docs ───────────────────────────────────────────
app.use('/api/cart/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/cart', cartRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cart-service' });
});
app.get('/metrics', metricsEndpoint);

app.use(createErrorHandler('cart-service'));
