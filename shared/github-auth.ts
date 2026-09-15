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
