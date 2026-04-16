import express from 'express';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

export const app = express();

app.use(metricsMiddleware('notification-service'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});
app.get('/metrics', metricsEndpoint);


