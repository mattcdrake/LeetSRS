import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    action: {
      default_popup: 'popup.html',
    },
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'alarms'],
    host_permissions: ['*://*.leetcode.com/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
