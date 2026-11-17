import { describe, expect, it } from 'vitest';

import app from '../../src/api/index';
import type { Product, ProductInput, Problem } from '../../src/api/index';
import spec from '../../openapi/openapi.json';
import { createMockDb } from './mock-d1';
import type { SeedRow } from './mock-d1';

const listOperationId = spec.paths['/api/products'].get.operationId;
const createOperationId = spec.paths['/api/products'].post.operationId;
const productKeys = [...spec.components.schemas.Product.required].sort();
const problemKeys = Object.keys(spec.components.schemas.Problem.properties).sort();

const SEED: SeedRow[] = [
  {
    name: 'Night Cream',
    brand: 'PM Co',
    step: 'moisturiser',
    session: 'pm',
    createdAt: '2026-11-17T00:00:00.000Z',
  },
  {
    name: 'Gentle Cleanser',
    brand: 'AM Co',
    step: 'cleanser',
    session: 'am',
    createdAt: '2026-11-17T00:00:00.000Z',
  },
];

describe('REQ-001 contract', () => {
  it('matches the Architect operationIds (listProducts, createProduct)', () => {
    expect(listOperationId).toBe('listProducts');
    expect(createOperationId).toBe('createProduct');
  });

  it('(a) GET /api/products returns 200 with ordered { items: Product[] }', async () => {
    const db = createMockDb(SEED);
    const res = await app.request('/api/products', {}, { DB: db });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Product[] };
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items.map((product) => product.name)).toEqual(['Gentle Cleanser', 'Night Cream']);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(productKeys);
    }
  });

  it('(b) the list query uses the fixed contract ordering clause', async () => {
    const db = createMockDb(SEED);
    await app.request('/api/products', {}, { DB: db });
    expect(
      db.queries.some((query) =>
        query.includes('ORDER BY session ASC, step_order ASC, created_at ASC, id ASC'),
      ),
    ).toBe(true);
  });

  it('(c) an empty routine returns 200 { items: [] }', async () => {
    const db = createMockDb();
    const res = await app.request('/api/products', {}, { DB: db });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Product[] };
    expect(body.items).toEqual([]);
  });

  it('(d) POST /api/products with a valid body returns 201 and the stored Product', async () => {
    const db = createMockDb();
    const input: ProductInput = {
      name: 'Gentle Cleanser',
      brand: 'AM Co',
      step: 'cleanser',
      session: 'am',
    };
    const res = await app.request(
      '/api/products',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
      { DB: db },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Product;
    expect(Object.keys(body).sort()).toEqual(productKeys);
    expect(typeof body.id).toBe('number');
    expect(typeof body.createdAt).toBe('string');
    expect(body.name).toBe(input.name);
    expect(body.brand).toBe(input.brand);
    expect(body.step).toBe(input.step);
    expect(body.session).toBe(input.session);
  });

  it('(e) POST with a missing brand returns 400 validation_error with Problem keys', async () => {
    const db = createMockDb();
    const res = await app.request(
      '/api/products',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Serum', step: 'serum', session: 'pm' }),
      },
      { DB: db },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Problem;
    expect(body.error).toBe('validation_error');
    expect(Object.keys(body).every((key) => problemKeys.includes(key))).toBe(true);
  });

  it('(f) POST with an unknown step returns 400', async () => {
    const db = createMockDb();
    const res = await app.request(
      '/api/products',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Thing', brand: 'Brand', step: 'tonic', session: 'am' }),
      },
      { DB: db },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Problem;
    expect(body.error).toBe('validation_error');
  });

  it('(g) POST with an extra property returns 400', async () => {
    const db = createMockDb();
    const res = await app.request(
      '/api/products',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Thing',
          brand: 'Brand',
          step: 'cleanser',
          session: 'am',
          extra: 'nope',
        }),
      },
      { DB: db },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Problem;
    expect(body.error).toBe('validation_error');
  });

  it('(h) POST without a JSON content-type returns 415', async () => {
    const db = createMockDb();
    const res = await app.request(
      '/api/products',
      {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ name: 'Thing', brand: 'Brand', step: 'cleanser', session: 'am' }),
      },
      { DB: db },
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as Problem;
    expect(body.error).toBe('unsupported_media_type');
  });

  it('(i) POST with a body over 4 KiB returns 413', async () => {
    const db = createMockDb();
    const res = await app.request(
      '/api/products',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'a'.repeat(5000),
          brand: 'Brand',
          step: 'cleanser',
          session: 'am',
        }),
      },
      { DB: db },
    );
    expect(res.status).toBe(413);
    const body = (await res.json()) as Problem;
    expect(body.error).toBe('payload_too_large');
  });
});
