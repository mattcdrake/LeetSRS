import {
  decideGistSync,
  type GistSyncConfigUpdate,
  type GistSyncStatus,
  type GistValidationResult,
  gistSyncConfigUpdateSchema,
  type SyncResult,
} from '@/domain/gist-sync';
import { translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { createGitHubClient, GIST_FILENAME } from '@/infrastructure/github/client';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import {
  parseLearningDocumentBackup,
  readLearningDocument,
  replaceLearningDocument,
} from '@/infrastructure/storage/learning-document';
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
  const { data } = await github.createGist(
    translations[language].settings.gistSync.gistDescription,
    JSON.stringify(document, null, 2)
  );
  if (!data.id) {
    throw new Error('Failed to create gist: no ID returned');
  }

  const gistId = data.id;
  await setGistSyncConfig({ gistId });

  const now = new Date().toISOString();
  await writeSyncStatus({ lastSyncTime: now, lastSyncDirection: 'push' });

  return { gistId };
}

export async function resetGistSyncStatus(): Promise<void> {
  await removeSyncStatus();
  lastError = null;
}

export async function setGistSyncConfig(config: GistSyncConfigUpdate): Promise<void> {
  const parsed = gistSyncConfigUpdateSchema.parse(config);
  const changes = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
  if (Object.keys(changes).length === 0) {
    return;
  }

  await writeGistConnection({ ...(await readGistConnection()), ...changes });
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
    return gistValidationError(error);
  }
}

function gistValidationError(error: unknown): GistValidationResult {
  if (!(error instanceof Error)) {
    return { valid: false, error: 'Unknown error validating Gist ID' };
  }

  if (error.message.includes('404')) {
    return { valid: false, error: 'Gist not found' };
  }

  return { valid: false, error: error.message };
}
