import {
  decideGistSync,
  type GistConnectionResult,
  type GistSetup,
  type GistSyncStatus,
  gistSetupSchema,
  type SyncResult,
} from '@/domain/gist-sync';
import { translations } from '@/i18n';
import { resolveLanguage } from '@/infrastructure/browser/language';
import { createGitHubClient, GIST_FILENAME } from '@/infrastructure/github/client';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { parseLearningDocumentBackup } from '@/infrastructure/storage/learning-document-conversions';
import { readSyncMetadata, removeSyncStatus, writeSyncStatus } from '@/infrastructure/storage/sync-metadata';

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

    const github = createGitHubClient(config.pat);

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

export { readGistConnection as getGistSyncConfig } from '@/infrastructure/storage/gist-connection';

export async function setupGistSync(input: GistSetup): Promise<GistConnectionResult> {
  let createdGistId: string | undefined;
  try {
    const setup = gistSetupSchema.parse(input);
    const previous = await readGistConnection();
    const github = createGitHubClient(setup.pat);
    let gistId: string;
    if (setup.mode === 'existing') {
      const { data } = await github.getGist(setup.gistId);
      if (!data.files?.[GIST_FILENAME]) {
        throw new Error(`Gist does not contain ${GIST_FILENAME}`);
      }
      gistId = setup.gistId;
    } else {
      const document = await readLearningDocument();
      const language = resolveLanguage(document.settings.language);
      const { data } = await github.createGist(
        translations[language].settings.gistSync.gistDescription,
        JSON.stringify(document, null, 2)
      );
      if (!data.id) throw new Error('Failed to create gist: no ID returned');
      gistId = data.id;
      createdGistId = gistId;
    }
    await writeGistConnection({ pat: setup.pat, gistId, enabled: previous.enabled });
    if (createdGistId) {
      try {
        const timestamp = new Date().toISOString();
        await writeSyncStatus({ lastSyncTime: timestamp, lastSyncDirection: 'push' });
        lastError = null;
        return { saved: true, sync: { success: true, action: 'pushed', timestamp } };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Failed to record Gist creation';
        return { saved: true, sync: { success: false, error: lastError } };
      }
    }
    return { saved: true, ...(previous.enabled ? { sync: await triggerGistSync() } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gist setup error';
    return {
      saved: false,
      error: message.includes('404') ? 'Gist not found' : message,
      ...(createdGistId ? { createdGistId } : {}),
    };
  }
}

export async function setGistSyncEnabled(enabled: boolean): Promise<GistConnectionResult> {
  try {
    const config = await readGistConnection();
    if (enabled && (!config.pat.trim() || !config.gistId?.trim())) {
      throw new Error('PAT and Gist ID are required to enable sync');
    }
    await writeGistConnection({ ...config, enabled });
  } catch (error) {
    return { saved: false, error: error instanceof Error ? error.message : 'Failed to save connection' };
  }
  return { saved: true, ...(enabled ? { sync: await triggerGistSync() } : {}) };
}

export async function resetGistSyncStatus(): Promise<void> {
  await removeSyncStatus();
  lastError = null;
}
