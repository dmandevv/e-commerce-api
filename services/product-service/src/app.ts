import express from 'express';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import productRoutes from './routes/productRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './swagger.js';

const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(express.json());

// ─── API Docs ───────────────────────────────────────────
app.use('/api/products/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Routes ─────────────────────────────────────────────
app.use('/api/products', productRoutes);

// ─── Health Check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'product-service' });
});

// ─── Error Handler (must be last) ───────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');

    app.listen(config.port, () => {
      console.log(`Product service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start product service:', err);
    process.exit(1);
  }
};

start();
