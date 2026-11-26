import { Hono } from 'hono';

export interface Health {
  status: 'ok';
  commit: string;
}

export const STEPS = ['cleanser', 'serum', 'moisturiser', 'spf'] as const;
export type Step = (typeof STEPS)[number];

export const SESSIONS = ['am', 'pm'] as const;
export type Session = (typeof SESSIONS)[number];

export interface Product {
  id: number;
  name: string;
  brand: string;
  step: Step;
  session: Session;
  createdAt: string;
}

export interface ProductInput {
  name: string;
  brand: string;
  step: Step;
  session: Session;
}

export type FieldName = 'name' | 'brand' | 'step' | 'session';

export interface FieldError {
  field: FieldName;
  message: string;
}

export interface Problem {
  error: string;
  message: string;
  details?: FieldError[];
}

/** Row shape of the `product` table as D1 returns it (see `migrations/0002_add_product.sql`). */
export interface ProductRow {
  id: number;
  name: string;
  brand: string;
  step: Step;
  session: Session;
  createdAt: string;
}

/**
 * Minimal structural view of the D1 binding these routes use. The Workers runtime supplies the
 * real `D1Database`; this checkout does not pull `@cloudflare/workers-types` into `tsconfig`
 * (`types` is `["node", "vite/client"]`), so only the used surface is declared here.
 */
export interface DbStatement {
  bind(...values: unknown[]): DbStatement;
  run(): Promise<{ meta: { last_row_id: number } }>;
  first(): Promise<ProductRow | null>;
  all(): Promise<{ results: ProductRow[] }>;
}

export interface Db {
  prepare(query: string): DbStatement;
}

export interface Env {
  DB: Db;
}

/** Request-body cap (design spec-add-product.md §5; OWASP API4): 4 KiB. */
export const MAX_BODY_BYTES = 4 * 1024;
/** `name`/`brand` length cap (contract + data-model.md): 80 characters. */
export const MAX_TEXT_LENGTH = 80;

const PRODUCT_COLUMNS = 'id, name, brand, step, session, created_at AS createdAt';
const INSERT_PRODUCT_SQL = 'INSERT INTO product (name, brand, step, session) VALUES (?, ?, ?, ?)';
const SELECT_PRODUCT_SQL = `SELECT ${PRODUCT_COLUMNS} FROM product WHERE id = ?`;
// Fixed contract ordering: session, then the declared step sequence, then createdAt, then id.
// `step_order` is the STORED generated column from the migration; never order by the `step` text.
const LIST_PRODUCTS_SQL =
  `SELECT ${PRODUCT_COLUMNS} FROM product ` +
  'ORDER BY session ASC, step_order ASC, created_at ASC, id ASC';

const STEP_SET: ReadonlySet<string> = new Set<string>(STEPS);
const SESSION_SET: ReadonlySet<string> = new Set<string>(SESSIONS);
const ALLOWED_KEYS: ReadonlySet<string> = new Set(['name', 'brand', 'step', 'session']);

function validateText(
  value: unknown,
  field: 'name' | 'brand',
  errors: FieldError[],
): string | undefined {
  if (typeof value !== 'string') {
    errors.push({ field, message: `${field} is required.` });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push({ field, message: `${field} is required.` });
    return undefined;
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    errors.push({
      field,
      message: `${field} must be at most ${String(MAX_TEXT_LENGTH)} characters.`,
    });
    return undefined;
  }
  return trimmed;
}

function validateStep(value: unknown, errors: FieldError[]): Step | undefined {
  if (typeof value !== 'string' || !STEP_SET.has(value)) {
    errors.push({ field: 'step', message: `step must be one of: ${STEPS.join(', ')}.` });
    return undefined;
  }
  return value as Step;
}

function validateSession(value: unknown, errors: FieldError[]): Session | undefined {
  if (typeof value !== 'string' || !SESSION_SET.has(value)) {
    errors.push({ field: 'session', message: `session must be one of: ${SESSIONS.join(', ')}.` });
    return undefined;
  }
  return value as Session;
}

export type ValidationResult = { ok: true; value: ProductInput } | { ok: false; problem: Problem };

export function validateProductInput(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      problem: { error: 'validation_error', message: 'Request body must be a JSON object.' },
    };
  }
  const body = raw as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((key) => !ALLOWED_KEYS.has(key));
  if (unexpected.length > 0) {
    const label = unexpected.length === 1 ? 'property' : 'properties';
    return {
      ok: false,
      problem: {
        error: 'validation_error',
        message: `Unexpected ${label}: ${unexpected.join(', ')}.`,
      },
    };
  }
  const errors: FieldError[] = [];
  const name = validateText(body.name, 'name', errors);
  const brand = validateText(body.brand, 'brand', errors);
  const step = validateStep(body.step, errors);
  const session = validateSession(body.session, errors);
  if (name === undefined || brand === undefined || step === undefined || session === undefined) {
    const problem: Problem = { error: 'validation_error', message: 'The request body is invalid.' };
    if (errors.length > 0) {
      problem.details = errors;
    }
    return { ok: false, problem };
  }
  return { ok: true, value: { name, brand, step, session } };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    step: row.step,
    session: row.session,
    createdAt: row.createdAt,
  };
}

const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.get('/health', (c) => c.json<Health>({ status: 'ok', commit: __COMMIT_SHA__ }));

app.get('/products', async (c) => {
  const { results } = await c.env.DB.prepare(LIST_PRODUCTS_SQL).all();
  return c.json({ items: results.map((row) => toProduct(row)) });
});

app.post('/products', async (c) => {
  const mediaType = (c.req.header('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (mediaType !== 'application/json') {
    return c.json<Problem>(
      { error: 'unsupported_media_type', message: 'Content-Type must be application/json.' },
      415,
    );
  }

  const contentLength = c.req.header('content-length');
  if (contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES) {
    return c.json<Problem>(
      {
        error: 'payload_too_large',
        message: `Request body must not exceed ${String(MAX_BODY_BYTES)} bytes.`,
      },
      413,
    );
  }

  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return c.json<Problem>(
      {
        error: 'payload_too_large',
        message: `Request body must not exceed ${String(MAX_BODY_BYTES)} bytes.`,
      },
      413,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return c.json<Problem>(
      { error: 'validation_error', message: 'Request body must be valid JSON.' },
      400,
    );
  }

  const validated = validateProductInput(parsed);
  if (!validated.ok) {
    return c.json<Problem>(validated.problem, 400);
  }

  const input = validated.value;
  const inserted = await c.env.DB.prepare(INSERT_PRODUCT_SQL)
    .bind(input.name, input.brand, input.step, input.session)
    .run();
  const stored = await c.env.DB.prepare(SELECT_PRODUCT_SQL).bind(inserted.meta.last_row_id).first();
  if (stored === null) {
    return c.json<Problem>(
      { error: 'internal_error', message: 'The product could not be stored.' },
      500,
    );
  }
  return c.json<Product>(toProduct(stored), 201);
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((_err, c) =>
  c.json<Problem>({ error: 'internal_error', message: 'An unexpected error occurred.' }, 500),
);

export default app;
