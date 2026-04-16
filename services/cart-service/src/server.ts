import { config } from './config/index.js';
import { cartRepository } from './repositories/cartRepository.js';
import { app } from './app.js';

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