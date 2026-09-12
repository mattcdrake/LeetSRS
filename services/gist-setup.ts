import { type GistSyncConfigUpdate, type GistValidationResult, gistSyncConfigUpdateSchema } from '@/domain/gist-sync';
import { GIST_FILENAME, type GitHubClient } from '@/infrastructure/github/client';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { getStoredTranslations } from '@/infrastructure/storage/translations';
import { getAuthenticatedGitHubClient } from './github-auth';
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
    const github = await getAuthenticatedGitHubClient(pat);
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

  const github = await getAuthenticatedGitHubClient(config.pat);
  return createGist(github);
}

export async function createGist(github: GitHubClient): Promise<{ gistId: string }> {
  const exportJson = await exportData();

  const { data } = await github.createGist(
    (await getStoredTranslations()).settings.gistSync.gistDescription,
    exportJson
  );

  if (!data.id) {
    throw new Error('Failed to create gist: no ID returned');
  }

  const gistId = data.id;

  await setGistSyncConfig({ gistId });

  const now = new Date().toISOString();
  await writeSyncMetadata('lastSyncTime', now);
  await writeSyncMetadata('lastSyncDirection', 'push');

  return { gistId };
}
