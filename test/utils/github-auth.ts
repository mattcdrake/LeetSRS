import { storage } from '#imports';

export async function seedGithubAuthorization() {
  await storage.setItem('local:leetsrs:githubAuthorization', {
    account: { id: 1, login: 'tester' },
    accessToken: 'new-token',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 3600000,
    refreshExpiresAt: Date.now() + 86400000,
  });
}
