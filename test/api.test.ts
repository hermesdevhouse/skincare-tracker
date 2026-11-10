import { describe, expect, it } from 'vitest';
import app from '../src/api/index';
import spec from '../openapi/openapi.json';

describe('API', () => {
  it('GET /api/health returns ok and the commit', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', commit: 'test' });
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
  });
});

describe('contract (openapi/openapi.json ↔ Hono routes)', () => {
  const implemented = new Set(
    app.routes.filter((r) => r.method !== 'ALL').map((r) => `${r.method} ${r.path}`),
  );
  const specified = new Set(
    Object.entries(spec.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((m) => `${m.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`),
    ),
  );

  it('every specified operation is implemented', () => {
    expect([...specified].filter((op) => !implemented.has(op))).toEqual([]);
  });

  it('every implemented operation is specified', () => {
    expect([...implemented].filter((op) => !specified.has(op))).toEqual([]);
  });
});
