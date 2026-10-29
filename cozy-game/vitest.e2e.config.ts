import { defineConfig } from 'vitest/config';

// Uçtan uca testler: önce `npm run build`, sonra `npm run test:e2e`.
// Tarayıcı: E2E_BROWSER=chromium (varsayılan) | webkit (iOS Safari motoru) | firefox
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    globalSetup: ['e2e/server.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
