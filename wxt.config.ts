import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import pkg from './package.json';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // Public Web Store key gives development and release builds the same ID.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyCs8P74QaC4RDxsBnZrDN2kmRVXiheAZlA+iKE3jYZ0y//nkx8VCwLtWukFWnz7/EJpzjuRTBKdl2eSMYtKGgaN1aF04HSSDqbWAiK5mOxmVbFqoHjdbutYAq2jnfF8rf6wILqTUbeCPa+ws2Yh3tf/XkUhAGeT4LPR+bllhbSefxM+npQW7Ntzu6Es+aWiInV9M9nUvwrRsVT9oqCIcPBaQ6uQ0zJAJtzUdMDNLkOz+4LvbHumNPrWyphKu6q3HbAYSMsKzRNylt8iW4TSijquIvvB8Zzapwt2TSoKKbj75jYNmvBfsHrHzXYhDtlgnKlV9Y4nCMWqzK4lbypJ50QIDAQAB',
    action: {
      default_popup: 'popup.html',
    },
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'alarms', 'activeTab', 'identity'],
    host_permissions: ['*://*.leetcode.com/*'],
    optional_host_permissions: [
      '*://*.leetcode.cn/*',
      'https://auth.leetsrs.com/*',
      'https://api.github.com/*',
      'https://gist.githubusercontent.com/*',
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  }),
});
