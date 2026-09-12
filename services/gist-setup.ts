import { type GistSyncConfigUpdate, type GistValidationResult, gistSyncConfigUpdateSchema } from '@/domain/gist-sync';
import { createGitHubClient, GIST_FILENAME, type GitHubClient } from '@/infrastructure/github/client';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { writeSyncStatus } from '@/infrastructure/storage/sync-metadata';
import { getStoredTranslations } from '@/infrastructure/storage/translations';
import { exportData } from './import-export';

export async function setGistSyncConfig(config: GistSyncConfigUpdate): Promise<void> {
  const parsed = gistSyncConfigUpdateSchema.parse(config);
  const changes = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
  if (Object.keys(changes).length === 0) return;
  await writeGistConnection({ ...(await readGistConnection()), ...changes });
}

export async function validateGistId(gistId: string, pat: string): Promise<GistValidationResult> {
  if (!gistId.trim()) {
    return { valid: false, error: 'Gist ID is required' };
  }

  try {
    const github = createGitHubClient(pat);
    return await validateGist(gistId, github);
  } catch (error) {
    return gistValidationError(error);
  }
}

export async function validateGist(gistId: string, github: GitHubClient): Promise<GistValidationResult> {
  if (!gistId.trim()) return { valid: false, error: 'Gist ID is required' };

  try {
    const { data } = await github.getGist(gistId);

    if (!data.files?.[GIST_FILENAME]) {
      return { valid: false, error: `Gist does not contain ${GIST_FILENAME}` };
    }

    return { valid: true };
  } catch (error) {
    return gistValidationError(error);
  }
}

function gistValidationError(error: unknown): GistValidationResult {
  if (!(error instanceof Error)) return { valid: false, error: 'Unknown error validating Gist ID' };
  if (error.message.includes('404')) return { valid: false, error: 'Gist not found' };
  return { valid: false, error: error.message };
}

export async function createNewGist(): Promise<{ gistId: string }> {
  const config = await readGistConnection();
  if (!config.pat) {
    throw new Error('PAT is required to create a gist');
  }

  const github = createGitHubClient(config.pat);
  const exportJson = await exportData();

  return createGistFromBackup(github, exportJson, (await getStoredTranslations()).settings.gistSync.gistDescription);
}

// Shared by the legacy and prepared document consumers until #379 removes the former.
export async function createGistFromBackup(
  github: GitHubClient,
  exportJson: string,
  description: string
): Promise<{ gistId: string }> {
  const { data } = await github.createGist(description, exportJson);

  if (!data.id) {
    throw new Error('Failed to create gist: no ID returned');
  }

  const gistId = data.id;

  await setGistSyncConfig({ gistId });

  const now = new Date().toISOString();
  await writeSyncStatus({ lastSyncTime: now, lastSyncDirection: 'push' });

  return { gistId };
}
