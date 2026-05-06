import express from 'express';
import { requestId, createRequestLogger } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';
import helmet from 'helmet';

export const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(requestId);
app.use(createRequestLogger('notification-service'));
app.use(metricsMiddleware('notification-service'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});
app.get('/metrics', metricsEndpoint);


