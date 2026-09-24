import { storage } from '#imports';

export const githubAuthorizationItem = storage.defineItem<unknown>('local:leetsrs:githubAuthorization');
export const githubSetupPendingItem = storage.defineItem<boolean>('local:leetsrs:githubSetupPending', {
  fallback: false,
});

export const GITHUB_HOST_PERMISSIONS = {
  origins: ['https://auth.leetsrs.com/*', 'https://api.github.com/*', 'https://gist.githubusercontent.com/*'],
};

export interface GithubAuthStatus {
  account: { id: number; login: string } | null;
  signingIn: boolean;
  error: 'signInFailed' | null;
  migrationNotice: boolean;
  setupPending: boolean;
}

export interface GistDestination {
  id: string;
  description: string;
  updatedAt: string;
  suggested: boolean;
}
