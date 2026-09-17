import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// Exercise local-calendar behavior across DST in every test worker.
process.env.TZ = 'America/Los_Angeles';

export default defineConfig({
  test: {
    silent: 'passed-only',
    mockReset: true,
    restoreMocks: true,
    setupFiles: './test/setup.ts',
  },
  plugins: [WxtVitest()],
});
