import { configDefaults, defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// Exercise local-calendar behavior across DST in every test worker.
process.env.TZ = 'America/Los_Angeles';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    silent: 'passed-only',
    mockReset: true,
    restoreMocks: true,
    setupFiles: './test/setup.ts',
  },
  plugins: [WxtVitest({ browser: process.env.TEST_BROWSER ?? 'chrome' })],
});
