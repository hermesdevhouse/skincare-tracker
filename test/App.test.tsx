// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from '../src/web/App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the API status once /api/health answers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
  );
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Dev House template');
  expect((await screen.findByText('API: ok')).getAttribute('role')).toBe('status');
});
