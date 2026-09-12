import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  test: {
    silent: 'passed-only',
    mockReset: true,
    restoreMocks: true,
    setupFiles: './test/setup.ts',
  },
  plugins: [WxtVitest()],
});
