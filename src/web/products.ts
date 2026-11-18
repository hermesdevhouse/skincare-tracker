/**
 * Client-side types and the API client for the skincare-tracker routine.
 *
 * The shapes mirror the OpenAPI contract `openapi/openapi.json` (the interface of record, owned by
 * the Architect). The client keeps its own view of them so the browser bundle never imports the
 * Hono app in `src/api/`. Sharing API types is an open question in the project's design notes.
 */

export const STEPS = ['cleanser', 'serum', 'moisturiser', 'spf'] as const;
export type Step = (typeof STEPS)[number];

export const SESSIONS = ['am', 'pm'] as const;
export type Session = (typeof SESSIONS)[number];

export const STEP_LABELS: Record<Step, string> = {
  cleanser: 'Cleanser',
  serum: 'Serum',
  moisturiser: 'Moisturiser',
  spf: 'SPF',
};

export const SESSION_LABELS: Record<Session, string> = { am: 'AM', pm: 'PM' };

/** The contract's declared step sequence (design/data-model.md) — not the `step` text order. */
const STEP_RANK: Record<Step, number> = { cleanser: 1, serum: 2, moisturiser: 3, spf: 4 };
const SESSION_RANK: Record<Session, number> = { am: 0, pm: 1 };

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

export type FieldName = keyof ProductInput;

export interface FieldError {
  field: FieldName;
  message: string;
}

export interface Problem {
  error: string;
  message: string;
  details?: FieldError[];
}

const FIELD_NAMES: readonly string[] = ['name', 'brand', 'step', 'session'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isStep(value: unknown): value is Step {
  return typeof value === 'string' && (STEPS as readonly string[]).includes(value);
}

function isSession(value: unknown): value is Session {
  return typeof value === 'string' && (SESSIONS as readonly string[]).includes(value);
}

function isFieldName(value: string): value is FieldName {
  return FIELD_NAMES.includes(value);
}

function toProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'number') return null;
  if (typeof value.name !== 'string' || typeof value.brand !== 'string') return null;
  if (!isStep(value.step) || !isSession(value.session)) return null;
  if (typeof value.createdAt !== 'string') return null;
  return {
    id: value.id,
    name: value.name,
    brand: value.brand,
    step: value.step,
    session: value.session,
    createdAt: value.createdAt,
  };
}

function toProblem(value: unknown): Problem | null {
  if (!isRecord(value)) return null;
  if (typeof value.error !== 'string' || typeof value.message !== 'string') return null;
  const problem: Problem = { error: value.error, message: value.message };
  if (isUnknownArray(value.details)) {
    const details: FieldError[] = [];
    for (const item of value.details) {
      if (
        isRecord(item) &&
        typeof item.field === 'string' &&
        typeof item.message === 'string' &&
        isFieldName(item.field)
      ) {
        details.push({ field: item.field, message: item.message });
      }
    }
    problem.details = details;
  }
  return problem;
}

/**
 * The contract's deterministic list order: session, then the declared step sequence, then
 * createdAt, then id. The client sorts with it after a no-reload insert.
 */
export function compareProducts(a: Product, b: Product): number {
  if (a.session !== b.session) return SESSION_RANK[a.session] - SESSION_RANK[b.session];
  if (a.step !== b.step) return STEP_RANK[a.step] - STEP_RANK[b.step];
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id - b.id;
}

export class ProductApiError extends Error {
  readonly status: number;
  readonly problem: Problem | null;

  constructor(status: number, problem: Problem | null) {
    super(problem?.message ?? 'The request failed.');
    this.name = 'ProductApiError';
    this.status = status;
    this.problem = problem;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return null;
  }
}

/** `GET /api/products` — the routine, already ordered by the contract. */
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
  const body = await readJson(response);
  if (!response.ok) throw new ProductApiError(response.status, toProblem(body));
  if (!isRecord(body) || !isUnknownArray(body.items)) {
    throw new ProductApiError(response.status, null);
  }
  const items: Product[] = [];
  for (const item of body.items) {
    const product = toProduct(item);
    if (product === null) throw new ProductApiError(response.status, null);
    items.push(product);
  }
  return items;
}

/** `POST /api/products` — creates one product and returns the stored record. */
export async function createProduct(input: ProductInput): Promise<Product> {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (response.status === 201) {
    const product = toProduct(body);
    if (product === null) throw new ProductApiError(response.status, null);
    return product;
  }
  throw new ProductApiError(response.status, toProblem(body));
}
