import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Workers Builds sets WORKERS_CI_COMMIT_SHA; the preview e2e job uses it to know the preview is current.
const commit = process.env.WORKERS_CI_COMMIT_SHA ?? 'local';

export default defineConfig({
  plugins: [react(), cloudflare()],
  define: { __COMMIT_SHA__: JSON.stringify(commit) },
});
