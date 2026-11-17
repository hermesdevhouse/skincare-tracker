import { compareProducts, type Product } from './products';
import { SessionList } from './SessionList';

export interface RoutineListProps {
  products: Product[];
}

export function RoutineList({ products }: RoutineListProps) {
  if (products.length === 0) {
    return <p className="routine-empty">No products yet.</p>;
  }
  const ordered = [...products].sort(compareProducts);
  const am = ordered.filter((product) => product.session === 'am');
  const pm = ordered.filter((product) => product.session === 'pm');
  return (
    <div className="routine">
      <SessionList session="am" products={am} />
      <SessionList session="pm" products={pm} />
    </div>
  );
}
