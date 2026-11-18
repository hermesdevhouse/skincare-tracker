import { SESSION_LABELS, STEP_LABELS, type Product, type Session } from './products';

export interface SessionListProps {
  session: Session;
  products: Product[];
}

function labelFor(product: Product): string {
  return `${product.name} — ${STEP_LABELS[product.step]} (${product.brand})`;
}

export function SessionList({ session, products }: SessionListProps) {
  const headingId = `routine-${session}-heading`;
  return (
    <section className="routine-session" aria-labelledby={headingId}>
      <h2 id={headingId}>{SESSION_LABELS[session]}</h2>
      <ol className="routine-list">
        {products.map((product) => (
          <li key={product.id}>{labelFor(product)}</li>
        ))}
      </ol>
    </section>
  );
}
