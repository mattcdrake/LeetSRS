export const GITHUB_HOST_PERMISSIONS = {
  origins: ['https://auth.leetsrs.com/*', 'https://api.github.com/*', 'https://gist.githubusercontent.com/*'],
};

export interface GithubAuthStatus {
  account: { id: number; login: string } | null;
  signingIn: boolean;
  error: 'signInFailed' | null;
  migrationNotice: boolean;
}

export interface GistDestination {
  id: string;
  description: string;
  updatedAt: string;
  suggested: boolean;
}
