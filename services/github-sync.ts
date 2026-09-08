import { decideGistSync, type GistSyncDecision, type GistSyncStatus, type SyncResult } from '@/domain/gist-sync';
import { GIST_FILENAME } from '@/infrastructure/github/client';
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

    const remoteFileContent = remoteGist.files?.[GIST_FILENAME]?.content ?? '';
    const decision = await getSyncDecision(remoteFileContent);

    if (decision.initializeDataUpdatedAt) {
      await writeSyncMetadata('dataUpdatedAt', new Date().toISOString());
    }

    if (decision.action === 'push') {
      const localExportJson = await exportData();
      await github.updateGist(config.gistId, localExportJson);
    } else if (decision.action === 'pull') {
      await importData(remoteFileContent);
    }

    const now = new Date().toISOString();
    await writeSyncMetadata('lastSyncTime', now);
    if (decision.action !== 'no-change') {
      await writeSyncMetadata('lastSyncDirection', decision.action);
    }
    const action = decision.action === 'push' ? 'pushed' : decision.action === 'pull' ? 'pulled' : 'no-change';
    return { success: true, action, timestamp: now };
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

async function getSyncDecision(remoteFileContent: string): Promise<GistSyncDecision> {
  if (!remoteFileContent) {
    return decideGistSync({ state: 'missing' }, undefined);
  }

  let remoteData: ExportData;
  try {
    remoteData = JSON.parse(remoteFileContent);
  } catch {
    return decideGistSync({ state: 'invalid-json' }, undefined);
  }

  // Read only after parsing succeeds, before accessing the remote timestamp.
  const localDataUpdatedAt = await readSyncMetadata('dataUpdatedAt');
  return decideGistSync({ state: 'parsed', dataUpdatedAt: remoteData.dataUpdatedAt }, localDataUpdatedAt);
}
