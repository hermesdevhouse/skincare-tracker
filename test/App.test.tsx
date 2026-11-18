// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/web/App';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(handler: (call: FetchCall) => Promise<Response>) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handler({ url: String(input), init }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

function product(id: number, name: string, step: string, session: string, createdAt: string) {
  return { id, name, brand: 'Acme', step, session, createdAt };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the empty state when the routine is empty', async () => {
  stubFetch(() => Promise.resolve(jsonResponse({ items: [] })));
  render(<App />);
  expect(await screen.findByText('No products yet.')).toBeTruthy();
  expect(screen.queryAllByRole('listitem')).toHaveLength(0);
});

it('labels the four fields', async () => {
  stubFetch(() => Promise.resolve(jsonResponse({ items: [] })));
  render(<App />);
  await screen.findByText('No products yet.');
  expect(screen.getByLabelText('Name')).toBeTruthy();
  expect(screen.getByLabelText('Brand')).toBeTruthy();
  expect(screen.getByLabelText('Step')).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Session' })).toBeTruthy();
  expect(screen.getByLabelText('AM')).toBeTruthy();
  expect(screen.getByLabelText('PM')).toBeTruthy();
});

it('shows AM and PM as separate lists ordered by step', async () => {
  const items = [
    product(4, 'Day serum', 'serum', 'am', '2026-01-01T00:00:04.000Z'),
    product(1, 'Morning cleanser', 'cleanser', 'am', '2026-01-01T00:00:01.000Z'),
    product(3, 'Night cream', 'moisturiser', 'pm', '2026-01-01T00:00:03.000Z'),
    product(2, 'Day SPF', 'spf', 'am', '2026-01-01T00:00:02.000Z'),
  ];
  stubFetch(() => Promise.resolve(jsonResponse({ items })));
  render(<App />);
  await screen.findByText('Morning cleanser — Cleanser (Acme)');
  const rows = screen.getAllByRole('listitem').map((row) => row.textContent);
  expect(rows).toEqual([
    'Morning cleanser — Cleanser (Acme)',
    'Day serum — Serum (Acme)',
    'Day SPF — SPF (Acme)',
    'Night cream — Moisturiser (Acme)',
  ]);
  expect(screen.getByRole('heading', { name: 'AM' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'PM' })).toBeTruthy();
});

it('blocks submit and shows a visible error when brand is empty', async () => {
  let posts = 0;
  stubFetch(({ init }) => {
    if (init?.method === 'POST') {
      posts += 1;
      return Promise.resolve(jsonResponse({}, 201));
    }
    return Promise.resolve(jsonResponse({ items: [] }));
  });
  render(<App />);
  await screen.findByText('No products yet.');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gentle Cleanser' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add product to routine' }));
  expect(await screen.findByText('Brand is required.')).toBeTruthy();
  expect(screen.getByLabelText('Brand').getAttribute('aria-invalid')).toBe('true');
  expect(posts).toBe(0);
});

it('adds the product without reloading after a successful submit', async () => {
  const created = product(7, 'Gentle Cleanser', 'cleanser', 'am', '2026-01-01T00:00:00.000Z');
  let postBody: unknown;
  stubFetch(({ init }) => {
    if (init?.method === 'POST') {
      postBody = JSON.parse(String(init.body));
      return Promise.resolve(jsonResponse(created, 201));
    }
    return Promise.resolve(jsonResponse({ items: [] }));
  });
  render(<App />);
  await screen.findByText('No products yet.');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Gentle Cleanser  ' } });
  fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('Step'), { target: { value: 'cleanser' } });
  fireEvent.click(screen.getByLabelText('AM'));
  fireEvent.click(screen.getByRole('button', { name: 'Add product to routine' }));
  expect(await screen.findByText('Gentle Cleanser — Cleanser (Acme)')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Added Gentle Cleanser.');
  expect(postBody).toEqual({
    name: 'Gentle Cleanser',
    brand: 'Acme',
    step: 'cleanser',
    session: 'am',
  });
});

it('shows an error and keeps the entered values when the save fails', async () => {
  stubFetch(({ init }) => {
    if (init?.method === 'POST') return Promise.reject(new Error('network down'));
    return Promise.resolve(jsonResponse({ items: [] }));
  });
  render(<App />);
  await screen.findByText('No products yet.');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gentle Cleanser' } });
  fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('Step'), { target: { value: 'cleanser' } });
  fireEvent.click(screen.getByLabelText('AM'));
  fireEvent.click(screen.getByRole('button', { name: 'Add product to routine' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('could not be saved');
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Gentle Cleanser');
});

it('shows the server field error when the API rejects the input', async () => {
  stubFetch(({ init }) => {
    if (init?.method === 'POST') {
      const problem = {
        error: 'validation_error',
        message: 'The request body is invalid.',
        details: [{ field: 'name', message: 'name is required.' }],
      };
      return Promise.resolve(jsonResponse(problem, 400));
    }
    return Promise.resolve(jsonResponse({ items: [] }));
  });
  render(<App />);
  await screen.findByText('No products yet.');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gentle Cleanser' } });
  fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('Step'), { target: { value: 'cleanser' } });
  fireEvent.click(screen.getByLabelText('AM'));
  fireEvent.click(screen.getByRole('button', { name: 'Add product to routine' }));
  expect(await screen.findByText('name is required.')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('invalid');
});
