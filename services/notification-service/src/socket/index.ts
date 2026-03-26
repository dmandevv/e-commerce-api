import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { JwtPayload } from '@ecommerce/shared/types';

/**
 * Creates and configures a Socket.IO server.
 *
 * Socket.IO works by "upgrading" an HTTP connection to a WebSocket.
 * The browser first makes a normal HTTP request, then the server
 * says "let's switch to WebSocket" and the connection stays open.
 */
export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    // CORS: which origins can connect via WebSocket.
    // In production, restrict this to your frontend domain.
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Path the client connects to. Default is /socket.io/.
    // NGINX will proxy WebSocket connections at this path.
    path: '/socket.io/',
  });

  // ─── Authentication middleware ────────────────────────
  // This runs ONCE when a client first connects (not on every message).
  // The client sends their JWT token, we verify it, and extract the user ID.
  // If the token is invalid, the connection is rejected.
  io.use((socket, next) => {
    // The client passes the token as: io("ws://...", { auth: { token: "..." } })
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      // Verify the JWT using the same secret all services share.
      // This is the same verification that the HTTP auth middleware does.
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      // Attach user data to the socket object so we can use it later.
      // socket.data persists for the lifetime of this connection.
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ───────────────────────────────
  // Runs after authentication succeeds.
  io.on('connection', (socket) => {
    const userId = socket.data.userId;

    // Join a "room" named after the user's ID.
    // Rooms are a Socket.IO concept — they group sockets together.
    // When we want to push an event to a specific user, we emit to
    // their room: io.to(userId).emit('event', data).
    // If the user has multiple tabs open, all tabs are in the same room
    // and all receive the event.
    socket.join(userId);
    console.log(`User ${userId} connected to notifications`);

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from notifications`);
    });
  });

  return io;
}
