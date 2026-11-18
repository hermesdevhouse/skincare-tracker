import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ProductApiError,
  compareProducts,
  createProduct,
  fetchProducts,
  type Product,
  type ProductInput,
} from '../../src/web/products';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function product(id: number, step: Product['step'], session: Product['session']): Product {
  return {
    id,
    name: `Product ${String(id)}`,
    brand: 'Acme',
    step,
    session,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('compareProducts', () => {
  it('orders by session, step sequence, createdAt, then id', () => {
    const list = [
      product(5, 'cleanser', 'pm'),
      product(2, 'spf', 'am'),
      product(3, 'cleanser', 'am'),
      product(1, 'cleanser', 'am'),
    ];
    expect([...list].sort(compareProducts).map((item) => item.id)).toEqual([1, 3, 2, 5]);
  });
});

describe('fetchProducts', () => {
  it('returns the routine items', async () => {
    const items = [product(1, 'cleanser', 'am')];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ items }))),
    );
    await expect(fetchProducts()).resolves.toEqual(items);
  });

  it('throws a ProductApiError carrying the status on failure', async () => {
    const body = { error: 'internal_error', message: 'nope' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(body, 500))),
    );
    const error: unknown = await fetchProducts().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProductApiError);
    expect((error as ProductApiError).status).toBe(500);
  });
});

describe('createProduct', () => {
  it('posts the input and returns the created product', async () => {
    const created = product(9, 'cleanser', 'am');
    let url = '';
    let options: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        options = init;
        return Promise.resolve(jsonResponse(created, 201));
      }),
    );
    const input: ProductInput = { name: 'P', brand: 'B', step: 'cleanser', session: 'am' };
    const result = await createProduct(input);
    expect(result).toEqual(created);
    expect(url).toBe('/api/products');
    expect(options?.method).toBe('POST');
  });

  it('throws a ProductApiError with the problem on a 400', async () => {
    const body = {
      error: 'validation_error',
      message: 'The request body is invalid.',
      details: [{ field: 'brand', message: 'brand is required.' }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(body, 400))),
    );
    const input: ProductInput = { name: 'P', brand: 'B', step: 'cleanser', session: 'am' };
    const error: unknown = await createProduct(input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProductApiError);
    expect((error as ProductApiError).problem?.details).toEqual(body.details);
  });
});
