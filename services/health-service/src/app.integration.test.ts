// ─── Integration Tests: Health Service API ───────────────
// Aggregator service — pings all microservices and reports status.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

// ─── Reset mocks ────────────────────────────────────────
beforeEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────
describe('GET /health', () => {
    it('should return ok and status 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok', service: 'health-service' });
    });
});

// ─────────────────────────────────────────────────────────
// GET /api/health/status (aggregate service health)
// ─────────────────────────────────────────────────────────
describe('GET /api/health/status', () => {

    it('should return healthy when all services are up', async () => {
        //all responses will be the same
        vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
        const res = await request(app).get('/api/health/status');
        expect(res.body.status).toBe('healthy');
        expect(global.fetch).toHaveBeenCalledTimes(6);
    });
    it('should return degraded if some services are down', async () => {
        vi.spyOn(global, 'fetch')
            //service 1 up
            .mockResolvedValueOnce({ ok: true } as Response)
            //service 2 down
            .mockRejectedValueOnce(new Error('connection refused'))
            //rest are up
            .mockResolvedValue({ ok: true } as Response);
        const res = await request(app).get('/api/health/status');
        expect(res.body.status).toBe('degraded');
        expect(global.fetch).toHaveBeenCalledTimes(6);
    });
    it('should return unhealthy if all services are down', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('connection refused'));
        const res = await request(app).get('/api/health/status');
        expect(res.body.status).toBe('unhealthy');
        expect(global.fetch).toHaveBeenCalledTimes(6);     
    });
});
