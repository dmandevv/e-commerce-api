import express from 'express';
import { config } from './config/index.js';
import helmet from 'helmet';

export const app = express();

interface ServiceHealth {
  status: 'up' | 'down';
  latency: number;
}

// ─── Middleware ──────────────────────────────────────────
app.use(helmet());

async function checkService(name: string, url: string): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: 'down', latency: Date.now() - start };
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'health-service' });
});

app.get('/api/health/status', async (_req, res) => {
  const results = await Promise.all(
    config.services.map(async (svc) => ({
      name: svc.name,
      ...(await checkService(svc.name, svc.url)),
    }))
  );

  const services: Record<string, ServiceHealth> = {};
  for (const r of results) {
    services[r.name] = { status: r.status, latency: r.latency };
  }

  const upCount = results.filter((r) => r.status === 'up').length;
  const overall = upCount === results.length ? 'healthy' : upCount === 0 ? 'unhealthy' : 'degraded';

  res.json({
    status: overall,
    timestamp: new Date().toISOString(),
    services,
  });
});


