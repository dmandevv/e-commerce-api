import mongoose from 'mongoose';
import { connectRabbitMQ } from './events/publisher.js';
import { app } from './app.js';
import { config } from './config/index.js';

// ─── Start ──────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');

    await connectRabbitMQ();

    app.listen(config.port, () => {
      console.log(`User service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start user service:', err);
    process.exit(1);
  }
};

start();
