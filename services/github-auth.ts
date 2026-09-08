import type { PatValidationResult } from '@/domain/gist-sync';
import { createGitHubClient, type GitHubClient } from '@/infrastructure/github/client';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';

export function getGitHubPat(): Promise<string | null> {
  return readSyncMetadata('githubPat');
}

export function setGitHubPat(pat: string): Promise<void> {
  return writeSyncMetadata('githubPat', pat);
}

export function removeGitHubPat(): Promise<void> {
  return removeSyncMetadata('githubPat');
}

// Readiness matches the existing truthy-credential gate without making a request.
export async function hasGitHubCredentials(): Promise<boolean> {
  return Boolean(await getGitHubPat());
}

export function getAuthenticatedGitHubClient(pat: string): Promise<GitHubClient>;
export function getAuthenticatedGitHubClient(): Promise<GitHubClient | null>;
export async function getAuthenticatedGitHubClient(pat?: string): Promise<GitHubClient | null> {
  // Supplied validation inputs bypass storage, including empty and untrimmed tokens.
  if (pat !== undefined) return createGitHubClient(pat);

  const storedPat = await getGitHubPat();
  return storedPat ? createGitHubClient(storedPat) : null;
}

export async function validatePat(pat: string): Promise<PatValidationResult> {
  if (!pat.trim()) {
    return { valid: false, error: 'PAT is required' };
  }

  try {
    const github = await getAuthenticatedGitHubClient(pat);
    const { data } = await github.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (error) {
    if (!(error instanceof Error)) {
      return { valid: false, error: 'Unknown error validating token' };
    }

    const { message } = error;

    if (message.includes('401')) {
      return { valid: false, error: 'Invalid token' };
    }

    if (message.includes('403')) {
      return { valid: false, error: 'Token lacks required permissions (needs gist scope)' };
    }

    return { valid: false, error: message };
  }
}
