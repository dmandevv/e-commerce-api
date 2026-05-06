import express from 'express';
import swaggerUi from 'swagger-ui-express';
import userRoutes from './routes/userRoutes.js';
import swaggerSpec from './swagger.js';
import { requestId, csrfProtection, createRequestLogger, createErrorHandler } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

export const app = express();

// ─── Middleware ──────────────────────────────────────────
// CORS is handled by the NGINX gateway — no need to set it here
app.use(helmet());
app.use(requestId);
app.use(createRequestLogger('user-service'));
app.use(metricsMiddleware('user-service'));

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// ─── API Docs ───────────────────────────────────────────
app.use('/api/users/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Routes ─────────────────────────────────────────────
app.use('/api/users', userRoutes);

// ─── Health Check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});
app.get('/metrics', metricsEndpoint);

// ─── Error Handler (must be last) ───────────────────────
app.use(createErrorHandler('user-service'));