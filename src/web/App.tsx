import { useEffect, useState } from 'react';

type State = 'loading' | 'ok' | 'error';

export function App() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => {
        setState(r.ok ? 'ok' : 'error');
      })
      .catch(() => {
        setState('error');
      });
  }, []);

  return (
    <main>
      <h1>Dev House template</h1>
      <p role="status">API: {state}</p>
    </main>
  );
}
