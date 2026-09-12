import { translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import type { GitHubClient } from '@/infrastructure/github/client';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { createGistFromBackup } from './gist-setup';
import { getAuthenticatedGitHubClient } from './github-auth';

// Prepared for the coordinated runtime activation in #378.
export async function createNewGist(): Promise<{ gistId: string }> {
  const config = await readGistConnection();
  if (!config.pat) {
    throw new Error('PAT is required to create a gist');
  }

  const github = await getAuthenticatedGitHubClient(config.pat);
  return createGist(github);
}

export async function createGist(github: GitHubClient): Promise<{ gistId: string }> {
  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }

  const language = document.settings.language ?? detectBrowserLanguage();
  return createGistFromBackup(
    github,
    JSON.stringify(document, null, 2),
    translations[language].settings.gistSync.gistDescription
  );
}
