import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __COMMIT_SHA__: JSON.stringify('test') },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    reporters: ['default', 'junit'],
    outputFile: { junit: 'reports/junit.xml' },
  },
});
