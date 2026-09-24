import { vi } from 'vitest';
import { browser } from 'wxt/browser';
import { githubAuthorizationItem } from '@/shared/gist-sync';

export async function seedGithubAuthorization() {
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => true);
  await githubAuthorizationItem.setValue({
    account: { id: 1, login: 'tester' },
    accessToken: 'new-token',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 3600000,
    refreshExpiresAt: Date.now() + 86400000,
  });
}
