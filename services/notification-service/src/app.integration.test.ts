// ─── Integration Tests: Notification Service API ─────────
// Consumer-only service — no REST routes, just health check.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

// ─────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────
describe('GET /health', () => {
    it('should return ok and status 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok', service: 'notification-service' });
    });
});
