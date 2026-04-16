import express from 'express';
import swaggerUi from 'swagger-ui-express';
import cartRoutes from './routes/cartRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

export const app = express();

app.use(requestId);
app.use(metricsMiddleware('cart-service'));
app.use(express.json());

// ─── API Docs ───────────────────────────────────────────
app.use('/api/cart/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/cart', cartRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cart-service' });
});
app.get('/metrics', metricsEndpoint);

app.use(errorHandler);
