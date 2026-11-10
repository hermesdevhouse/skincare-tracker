import { Hono } from 'hono';

export interface Health {
  status: 'ok';
  commit: string;
}

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json<Health>({ status: 'ok', commit: __COMMIT_SHA__ }));

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
