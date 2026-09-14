import { Octokit } from 'octokit';
import { parseLearningDocumentBackup } from '@/background/legacy/learning-document-conversions';
import { translations } from '@/shared/i18n/index';
import type {
  GistConnectionResult,
  GistSetup,
  GistSyncConfig,
  GistSyncErrorCode,
  GistSyncStatus,
} from '@/shared/models';
import { detectBrowserLanguage } from '@/shared/settings';
import {
  readGistConnection,
  readLearningDocument,
  readSyncStatus,
  removeSyncStatus,
  replaceLearningDocument,
  writeGistConnection,
  writeSyncStatus,
} from '@/shared/storage';

const GIST_FILENAME = 'leetsrs-backup.json';

let activeSync: Promise<void> | undefined;
let generation = 0;
let lastError: GistSyncErrorCode | null = null;

// Sync is deliberately just whole-document last-write-wins. Startup, local saves,
// enabling, and the minute alarm all call the same function; overlapping calls share
// one promise. A generation change stops document sync started before a reset, import,
// or connection change from applying a stale result.

export function invalidateGistSync(): void {
  generation++;
  activeSync = undefined;
}

export function triggerGistSync(): Promise<void> {
  if (activeSync) {
    return activeSync;
  }

  const sync = runSync(generation);
  activeSync = sync;
  void sync.finally(() => {
    if (activeSync === sync) {
      activeSync = undefined;
    }
  });
  return sync;
}

async function runSync(startGeneration: number): Promise<void> {
  try {
    const config = await readGistConnection();
    if (generation !== startGeneration || !canSync(config)) {
      return;
    }

    lastError = null;
    await syncDocument(config, startGeneration);
  } catch (error) {
    if (generation === startGeneration) {
      lastError = syncErrorCode(error);
    }
  }
}

async function syncDocument(config: GistSyncConfig & { gistId: string }, startGeneration: number): Promise<void> {
  const github = new Octokit({ auth: config.pat });
  const { data } = await github.rest.gists.get({ gist_id: config.gistId });
  if (generation !== startGeneration) return;

  const remoteFile = data.files?.[GIST_FILENAME];
  const remote = remoteFile ? parseLearningDocumentBackup(remoteFile.content ?? '') : undefined;
  const local = await readLearningDocument();
  if (generation !== startGeneration) return;

  let direction: 'push' | 'pull' | undefined;
  if (
    !remote?.dataUpdatedAt ||
    (local.dataUpdatedAt && Date.parse(local.dataUpdatedAt) > Date.parse(remote.dataUpdatedAt))
  ) {
    await github.rest.gists.update({
      gist_id: config.gistId,
      files: { [GIST_FILENAME]: { content: JSON.stringify(local, null, 2) } },
    });
    direction = 'push';
  } else if (!local.dataUpdatedAt || Date.parse(local.dataUpdatedAt) < Date.parse(remote.dataUpdatedAt)) {
    await replaceLearningDocument(remote);
    direction = 'pull';
  }
  if (generation !== startGeneration) return;

  const timestamp = new Date().toISOString();
  await writeSyncStatus({ lastSyncTime: timestamp, lastSyncDirection: direction });
}

function canSync(config: GistSyncConfig): config is GistSyncConfig & { gistId: string } {
  return config.enabled && !!config.pat.trim() && !!config.gistId?.trim();
}

export async function getGistSyncStatus(): Promise<GistSyncStatus> {
  const status = await readSyncStatus();
  return {
    ...status,
    syncInProgress: activeSync !== undefined,
    lastError,
  };
}

export async function setupGistSync(setup: GistSetup): Promise<GistConnectionResult> {
  try {
    const github = new Octokit({ auth: setup.pat });
    let gistId: string;

    if (setup.mode === 'existing') {
      const { data } = await github.rest.gists.get({ gist_id: setup.gistId });
      if (!data.files?.[GIST_FILENAME]) {
        return { saved: false, error: 'missingBackup' };
      }
      gistId = setup.gistId;
    } else {
      const document = await readLearningDocument();
      const language = document.settings.language ?? detectBrowserLanguage();
      const { data } = await github.rest.gists.create({
        description: translations[language].settings.gistSync.gistDescription,
        public: false,
        files: { [GIST_FILENAME]: { content: JSON.stringify(document, null, 2) } },
      });
      if (!data.id) {
        return { saved: false, error: 'creationFailed' };
      }
      gistId = data.id;
    }

    invalidateGistSync();
    await writeGistConnection({ pat: setup.pat, gistId, enabled: true });
    return { saved: true };
  } catch (error) {
    return { saved: false, error: syncErrorCode(error, 'connectionSaveFailed') };
  }
}

export async function setGistSyncEnabled(enabled: boolean): Promise<GistConnectionResult> {
  try {
    const config = await readGistConnection();
    if (enabled && !config.pat.trim()) {
      return { saved: false, error: 'missingToken' };
    }
    if (enabled && !config.gistId?.trim()) {
      return { saved: false, error: 'missingGist' };
    }

    invalidateGistSync();
    await writeGistConnection({ ...config, enabled });
    return { saved: true };
  } catch (error) {
    return { saved: false, error: syncErrorCode(error, 'connectionSaveFailed') };
  }
}

export async function resetGistSyncStatus(): Promise<void> {
  await removeSyncStatus();
  lastError = null;
}

function syncErrorCode(error: unknown, fallback: GistSyncErrorCode = 'unknown'): GistSyncErrorCode {
  const message = error instanceof Error ? error.message : '';
  let status: unknown;
  if (error && typeof error === 'object' && 'status' in error) {
    status = error.status;
  }

  if (/rate limit/i.test(message) || status === 429) return 'rateLimit';
  if (status === 401 || status === 403 || /401|403|bad credentials/i.test(message)) return 'authentication';
  if (status === 404 || /404/.test(message)) return 'gistNotFound';
  if (/fetch|network|offline|timeout/i.test(message) || (typeof status === 'number' && status >= 500)) {
    return 'unavailable';
  }
  return fallback;
}
