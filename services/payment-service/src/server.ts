import { config } from './config/index.js';
import { connectRabbitMQ } from './events/publisher.js';
import { startConsumer } from './events/consumer.js';
import { app } from './app.js';

const start = async (): Promise<void> => {
  try {
    await connectRabbitMQ();
    await startConsumer();

    app.listen(config.port, () => {
      console.log(`Payment service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start payment service:', err);
    process.exit(1);
  }
};

start();