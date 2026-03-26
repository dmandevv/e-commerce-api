import express from 'express';
import { createServer } from 'http';
import { config } from './config/index.js';
import { initEmailService } from './services/emailService.js';
import { startConsumer } from './events/consumer.js';
import { initSocketServer } from './socket/index.js';
import { metricsMiddleware, metricsEndpoint } from '@ecommerce/shared/metrics';

const app = express();

// Create an HTTP server manually instead of using app.listen().
// Both Express and Socket.IO attach to this same server.
// Express handles normal HTTP requests (/health, /metrics).
// Socket.IO handles WebSocket upgrade requests (ws://...).
const httpServer = createServer(app);

app.use(metricsMiddleware('notification-service'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});
app.get('/metrics', metricsEndpoint);

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
      console.log(`Notification service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start notification service:', err);
    process.exit(1);
  }
};

start();
