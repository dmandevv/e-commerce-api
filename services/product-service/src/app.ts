import express from 'express';
import swaggerUi from 'swagger-ui-express';
import productRoutes from './routes/productRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

export const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(requestId);
app.use(metricsMiddleware('product-service'));
app.use(express.json());
app.use(cookieParser());

// ─── API Docs ───────────────────────────────────────────
app.use('/api/products/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Routes ─────────────────────────────────────────────
app.use('/api/products', productRoutes);

// ─── Health Check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'product-service' });
});
app.get('/metrics', metricsEndpoint);

// ─── Error Handler (must be last) ───────────────────────
app.use(errorHandler);
