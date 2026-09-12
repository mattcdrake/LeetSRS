import { decideGistSync, type GistSyncStatus, type SyncResult } from '@/domain/gist-sync';
import { GIST_FILENAME } from '@/infrastructure/github/client';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import {
  parseLearningDocumentBackup,
  readLearningDocument,
  replaceLearningDocument,
} from '@/infrastructure/storage/learning-document';
import { readSyncMetadata, writeSyncStatus } from '@/infrastructure/storage/sync-metadata';
import { getAuthenticatedGitHubClient } from './github-auth';

// Prepared for the coordinated runtime activation in #378.
// Keep the legacy workflow authoritative until then; #379 removes its duplicate
// request/error handling along with the old persistence path.
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
  syncInProgress = true;
  lastError = null;

  try {
    const config = await readGistConnection();

    if (!config.pat) {
      return { success: false, error: 'PAT is not configured' };
    }

    if (!config.gistId) {
      return { success: false, error: 'Gist ID is not configured' };
    }

    const github = await getAuthenticatedGitHubClient(config.pat);

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

    const remoteFile = remoteGist.files?.[GIST_FILENAME];
    // Validate even when local data would win, before either side can be overwritten.
    const remote = remoteFile ? parseLearningDocumentBackup(remoteFile.content ?? '') : undefined;
    const local = await readLearningDocument();
    if (!local) {
      throw new Error('Learning document is not initialized');
    }

    const { action } = decideGistSync(
      remote ? { state: 'parsed', dataUpdatedAt: remote.dataUpdatedAt } : { state: 'missing' },
      local.dataUpdatedAt
    );

    // Sync never creates a learner edit, including when both timestamps are absent.
    if (action === 'push') {
      await github.updateGist(config.gistId, JSON.stringify(local, null, 2));
    } else if (action === 'pull' && remote) {
      await replaceLearningDocument(remote);
    }

    const now = new Date().toISOString();
    await writeSyncStatus({
      lastSyncTime: now,
      lastSyncDirection: action === 'no-change' ? undefined : action,
    });
    const resultActions = { push: 'pushed', pull: 'pulled', 'no-change': 'no-change' } as const;
    return { success: true, action: resultActions[action], timestamp: now };
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
