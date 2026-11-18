import type { Db, DbStatement, ProductRow, Session, Step } from '../../src/api/index';

const STEP_ORDER: Record<Step, number> = { cleanser: 1, serum: 2, moisturiser: 3, spf: 4 };
const CREATED_AT = '2026-11-17T00:00:00.000Z';

export interface SeedRow {
  name: string;
  brand: string;
  step: Step;
  session: Session;
  createdAt: string;
}

export interface MockDb extends Db {
  /** Rows in insertion order (for assertions). */
  rows: ProductRow[];
  /** Every SQL string passed to `prepare()`, in order (to assert the list ordering clause). */
  queries: string[];
}

function compareRows(a: ProductRow, b: ProductRow): number {
  if (a.session !== b.session) {
    return a.session === 'am' ? -1 : 1;
  }
  const byStep = STEP_ORDER[a.step] - STEP_ORDER[b.step];
  if (byStep !== 0) {
    return byStep;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return a.id - b.id;
}

export function createMockDb(seed: SeedRow[] = []): MockDb {
  const rows: ProductRow[] = seed.map((row, index) => ({ id: index + 1, ...row }));
  const queries: string[] = [];
  let nextId = rows.length + 1;

  function statement(query: string): DbStatement {
    let params: unknown[] = [];
    const prepared: DbStatement = {
      bind(...values: unknown[]): DbStatement {
        params = values;
        return prepared;
      },
      run(): Promise<{ meta: { last_row_id: number } }> {
        if (query.includes('INSERT INTO product')) {
          const [name, brand, step, session] = params;
          rows.push({
            id: nextId,
            name: String(name),
            brand: String(brand),
            step: step as Step,
            session: session as Session,
            createdAt: CREATED_AT,
          });
          return Promise.resolve({ meta: { last_row_id: nextId++ } });
        }
        return Promise.resolve({ meta: { last_row_id: 0 } });
      },
      first(): Promise<ProductRow | null> {
        if (query.includes('WHERE id = ?')) {
          const id = Number(params[0]);
          return Promise.resolve(rows.find((row) => row.id === id) ?? null);
        }
        return Promise.resolve(null);
      },
      all(): Promise<{ results: ProductRow[] }> {
        return Promise.resolve({ results: [...rows].sort(compareRows) });
      },
    };
    return prepared;
  }

  return {
    rows,
    queries,
    prepare(query: string): DbStatement {
      queries.push(query);
      return statement(query);
    },
  };
}
