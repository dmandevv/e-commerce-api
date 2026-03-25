import express from 'express';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';
import { requestId } from '@ecommerce/shared/middleware';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

const app = express();

// ─── Middleware ──────────────────────────────────────────
// CORS is handled by the NGINX gateway — no need to set it here
app.use(requestId);
app.use(metricsMiddleware('user-service'));
app.use(express.json());

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
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');

    app.listen(config.port, () => {
      console.log(`User service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start user service:', err);
    process.exit(1);
  }
};

start();
