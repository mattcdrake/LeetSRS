import type { GistSyncStatus, SyncResult } from '@/domain/gist-sync';
import { GIST_FILENAME, type GitHubClient } from '@/infrastructure/github/client';
import type { ExportData } from '@/infrastructure/storage/backup/codec';
import { readSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { getGistDestinationConfig } from './gist-setup';
import { getAuthenticatedGitHubClient, getGitHubPat } from './github-auth';
import { exportData, importData } from './import-export';

// In-memory state for sync status (not persisted)
let syncInProgress = false;
let lastError: string | null = null;

export async function getGistSyncStatus(): Promise<GistSyncStatus> {
  const lastSyncTime = (await readSyncMetadata('lastSyncTime')) ?? null;
  const lastSyncDirection = (await readSyncMetadata('lastSyncDirection')) ?? null;
  return {
    lastSyncTime,
    lastSyncDirection,
    syncInProgress,
    lastError,
  };
}

export async function triggerGistSync(): Promise<SyncResult> {
  if (syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }

  syncInProgress = true;
  lastError = null;

  try {
    const [pat, config] = await Promise.all([getGitHubPat(), getGistDestinationConfig()]);

    if (!pat) {
      return { success: false, error: 'PAT is not configured' };
    }

    if (!config.gistId) {
      return { success: false, error: 'Gist ID is not configured' };
    }

    const github = await getAuthenticatedGitHubClient(pat);

    let remoteGist: Awaited<ReturnType<typeof github.getGist>>['data'];
    try {
      const { data } = await github.getGist(config.gistId);
      remoteGist = data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return { success: false, error: 'Gist not found' };
      }
      throw error;
    }

    const remoteFileContent = remoteGist.files?.[GIST_FILENAME]?.content;
    if (!remoteFileContent) {
      const localExportJson = await exportData();
      return await pushToGist(github, config.gistId, localExportJson);
    }

    let remoteData: ExportData;
    try {
      remoteData = JSON.parse(remoteFileContent);
    } catch {
      const localExportJson = await exportData();
      return await pushToGist(github, config.gistId, localExportJson);
    }

    const localDataUpdatedAt = await readSyncMetadata('dataUpdatedAt');

    // Handle missing dataUpdatedAt (legacy or fresh install)
    if (!localDataUpdatedAt && remoteData.dataUpdatedAt) {
      return await pullFromGist(remoteFileContent);
    }
    if (!remoteData.dataUpdatedAt) {
      if (!localDataUpdatedAt) {
        await writeSyncMetadata('dataUpdatedAt', new Date().toISOString());
      }
      const localExportJson = await exportData();
      return await pushToGist(github, config.gistId, localExportJson);
    }

    if (!localDataUpdatedAt) {
      throw new Error('Local data update timestamp is missing');
    }
    const localUpdated = new Date(localDataUpdatedAt);
    const remoteUpdated = new Date(remoteData.dataUpdatedAt);

    if (localUpdated < remoteUpdated) {
      return await pullFromGist(remoteFileContent);
    }

    if (localUpdated > remoteUpdated) {
      const localExportJson = await exportData();
      return await pushToGist(github, config.gistId, localExportJson);
    }

    const now = new Date().toISOString();
    await writeSyncMetadata('lastSyncTime', now);
    return { success: true, action: 'no-change', timestamp: now };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    lastError = errorMessage;

    if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
      return { success: false, error: 'GitHub API rate limit exceeded. Please try again later.' };
    }

    return { success: false, error: errorMessage };
  } finally {
    syncInProgress = false;
  }
}

async function pushToGist(github: GitHubClient, gistId: string, content: string): Promise<SyncResult> {
  await github.updateGist(gistId, content);

  const now = new Date().toISOString();
  await writeSyncMetadata('lastSyncTime', now);
  await writeSyncMetadata('lastSyncDirection', 'push');

  return { success: true, action: 'pushed', timestamp: now };
}

async function pullFromGist(content: string): Promise<SyncResult> {
  await importData(content);

  const now = new Date().toISOString();
  await writeSyncMetadata('lastSyncTime', now);
  await writeSyncMetadata('lastSyncDirection', 'pull');

  return { success: true, action: 'pulled', timestamp: now };
}
