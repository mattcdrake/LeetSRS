import type { PatValidationResult } from '@/domain/gist-sync';
import { createGitHubClient } from '@/infrastructure/github/client';

export async function validatePat(pat: string): Promise<PatValidationResult> {
  if (!pat.trim()) {
    return { valid: false, error: 'PAT is required' };
  }

  try {
    const github = createGitHubClient(pat);
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
