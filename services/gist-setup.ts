import type { GistSyncConfig, GistValidationResult } from '@/domain/gist-sync';
import { createGitHubClient, GIST_FILENAME } from '@/infrastructure/github/client';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { getStoredTranslations } from '@/infrastructure/storage/translations';
import { getGitHubPat, setGitHubPat } from './github-auth';
import { exportData } from './import-export';

export async function getGistSyncConfig(): Promise<GistSyncConfig> {
  const [pat, gistId, enabled] = await Promise.all([
    getGitHubPat(),
    readSyncMetadata('gistId'),
    readSyncMetadata('gistSyncEnabled'),
  ]);
  return { pat: pat ?? '', gistId: gistId ?? null, enabled: enabled ?? false };
}

export async function setGistSyncConfig(config: Partial<GistSyncConfig>): Promise<void> {
  if (config.pat !== undefined) {
    await setGitHubPat(config.pat);
  }
  if (config.gistId !== undefined) {
    if (config.gistId === null) {
      await removeSyncMetadata('gistId');
    } else {
      await writeSyncMetadata('gistId', config.gistId);
    }
  }
  if (config.enabled !== undefined) {
    await writeSyncMetadata('gistSyncEnabled', config.enabled);
  }
}

export async function validateGistId(gistId: string, pat: string): Promise<GistValidationResult> {
  if (!gistId.trim()) {
    return { valid: false, error: 'Gist ID is required' };
  }

  try {
    const github = createGitHubClient(pat);
    const { data } = await github.getGist(gistId);

    if (!data.files?.[GIST_FILENAME]) {
      return { valid: false, error: `Gist does not contain ${GIST_FILENAME}` };
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        return { valid: false, error: 'Gist not found' };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown error validating Gist ID' };
  }
}

export async function createNewGist(): Promise<{ gistId: string }> {
  const config = await getGistSyncConfig();
  if (!config.pat) {
    throw new Error('PAT is required to create a gist');
  }

  const github = createGitHubClient(config.pat);
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
