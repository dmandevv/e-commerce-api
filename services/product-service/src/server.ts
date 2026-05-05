import mongoose from 'mongoose';
import { config } from './config/index.js';
import { app } from './app.js';
import { startConsumer } from './events/consumer.js';


// ─── Start ──────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');

    app.listen(config.port, () => {
      console.log(`Product service running on port ${config.port}`);
    });

    await startConsumer();

  } catch (err) {
    console.error('Failed to start product service:', err);
    process.exit(1);
  }
};

start();