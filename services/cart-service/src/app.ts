import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { cartRepository } from './repositories/cartRepository.js';
import cartRoutes from './routes/cartRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

const app = express();

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

const start = async (): Promise<void> => {
  try {
    await cartRepository.connect();

    app.listen(config.port, () => {
      console.log(`Cart service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start cart service:', err);
    process.exit(1);
  }
};

start();
