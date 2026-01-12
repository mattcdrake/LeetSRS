import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    action: {
      default_popup: 'popup.html',
    },
    name: 'LeetSRS',
    permissions: ['storage', 'alarms'],
    host_permissions: ['*://*.leetcode.com/*', '*://api.github.com/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
