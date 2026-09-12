import { translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { createGitHubClient } from '@/infrastructure/github/client';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { createGistFromBackup } from './gist-setup';

// Prepared for the coordinated runtime activation in #378.
export async function createNewGist(): Promise<{ gistId: string }> {
  const config = await readGistConnection();
  if (!config.pat) {
    throw new Error('PAT is required to create a gist');
  }

  const github = createGitHubClient(config.pat);
  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }

  // Resolve from the exported snapshot; the translation storage adapter would
  // read a second document that could have a different language.
  const language = document.settings.language ?? detectBrowserLanguage();
  return createGistFromBackup(
    github,
    JSON.stringify(document, null, 2),
    translations[language].settings.gistSync.gistDescription
  );
}
