import { createLogger } from '@ecommerce/shared/logger';
import { config } from './config/index.js';
import { initEmailService } from './services/emailService.js';
import { startConsumer } from './events/consumer.js';
import { initSocketServer } from './socket/index.js';
import { createServer } from 'http';
import { app } from './app.js';

const logger = createLogger('notification-service');

// Create an HTTP server manually instead of using app.listen().
// Both Express and Socket.IO attach to this same server.
// Express handles normal HTTP requests (/health, /metrics).
// Socket.IO handles WebSocket upgrade requests (ws://...).
const httpServer = createServer(app);

const start = async (): Promise<void> => {
  try {
    initEmailService();

    // Initialize Socket.IO — attaches to the HTTP server and starts
    // listening for WebSocket connections on the same port.
    const io = initSocketServer(httpServer);

    // Pass the Socket.IO instance to the consumer so it can push
    // real-time events to connected clients.
    await startConsumer(io);

    // Use httpServer.listen() instead of app.listen().
    // app.listen() creates its own HTTP server internally — we already
    // created one above, so we listen on that directly.
    httpServer.listen(config.port, () => {
      logger.info({ port: config.port }, 'Service started');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
};

start();