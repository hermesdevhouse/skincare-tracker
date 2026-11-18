import { useCallback, useEffect, useState } from 'react';
import { ProductForm, type SubmitResult } from './ProductForm';
import { RoutineList } from './RoutineList';
import {
  ProductApiError,
  compareProducts,
  createProduct,
  fetchProducts,
  type Product,
  type ProductInput,
} from './products';

type LoadState = 'loading' | 'ready' | 'error';

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((items) => {
        if (cancelled) return;
        setProducts([...items].sort(compareProducts));
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(async (input: ProductInput): Promise<SubmitResult> => {
    try {
      const product = await createProduct(input);
      setProducts((previous) => [...previous, product].sort(compareProducts));
      setStatusMessage(`Added ${product.name}.`);
      return { ok: true };
    } catch (error) {
      const problem = error instanceof ProductApiError ? error.problem : null;
      if (problem !== null && problem.details !== undefined && problem.details.length > 0) {
        return { ok: false, fieldErrors: problem.details, message: problem.message };
      }
      const message =
        problem !== null ? problem.message : 'The product could not be saved. Please try again.';
      return { ok: false, fieldErrors: [], message };
    }
  }, []);

  return (
    <main className="app">
      <h1>My routine</h1>
      <ProductForm onSubmit={handleSubmit} />
      <p className="app-status" role="status">
        {statusMessage}
      </p>
      {loadState === 'loading' ? <p className="loading">Loading routine…</p> : null}
      {loadState === 'error' ? (
        <p className="error" role="alert">
          The routine could not be loaded. Please refresh to try again.
        </p>
      ) : null}
      {loadState === 'ready' ? <RoutineList products={products} /> : null}
    </main>
  );
}
