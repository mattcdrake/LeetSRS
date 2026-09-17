import { Octokit } from 'octokit';
import { storage } from '#imports';
import {
  authGeneration,
  GithubAuthorizationError,
  getGithubAuthorization,
  signOutGithub,
} from '@/background/github-auth';
import { dismissMigrationNotice, previousGist } from '@/background/legacy/github-pat';
import { parseLearningDocumentBackup } from '@/background/legacy/learning-document-conversions';
import { removeLegacyLearningData } from '@/background/legacy/learning-document-startup';
import type { GistDestination } from '@/shared/github-auth';
import { translations } from '@/shared/i18n/index';
import type {
  GistConnectionResult,
  GistSetup,
  GistSyncConfig,
  GistSyncErrorCode,
  GistSyncStatus,
} from '@/shared/models';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import { detectBrowserLanguage } from '@/shared/settings';
import {
  readGistConnection,
  readLearningDocument,
  readSyncStatus,
  removeGistConnection,
  removeSyncStatus,
  replaceLearningDocument,
  STORAGE_KEYS,
  writeGistConnection,
  writeSyncStatus,
} from '@/shared/storage';

const GIST_FILENAME = 'leetsrs-backup.json';

let activeSync: Promise<void> | undefined;
let generation = 0;
let lastError: GistSyncErrorCode | null = null;

// Remember observed values so our own storage notification and completed operation
// share a sync attempt, even when the notification arrives after the write resolves.
let observedConnection: GistSyncConfig | null | undefined;

function observeConnection(connection: GistSyncConfig | null): boolean {
  const destinationChanged =
    connection?.accountId !== observedConnection?.accountId || connection?.gistId !== observedConnection?.gistId;
  if (!destinationChanged && connection?.enabled === observedConnection?.enabled) return false;
  observedConnection = connection;
  if (destinationChanged) invalidateGistSync();
  return true;
}

export function watchGistConnectionChanges(ready: Promise<void>): void {
  observedConnection = undefined;
  storage.watch<GistSyncConfig>(STORAGE_KEYS.gistConnection, (connection) => {
    if (observeConnection(connection)) {
      void ready.then(sync, () => {});
    }
  });
}

async function saveConnection(connection: GistSyncConfig): Promise<void> {
  const previousConnection = observedConnection;
  await writeGistConnection(connection);
  // A notification may already have completed this connection's sync before the
  // write resolves. An unchanged connection still needs the explicit trigger.
  if (observeConnection(connection) || observedConnection === previousConnection) {
    void sync();
  }
}

export async function saveEdit(document: LearningDocument, editedAt: Date): Promise<void> {
  await replaceLearningDocument({ ...document, dataUpdatedAt: editedAt.toISOString() });
  void sync();
}

export async function restoreBackup(json: string): Promise<void> {
  const document = parseLearningDocumentBackup(json);
  await replaceLearningDocument(document);
}

export async function resetAllData(): Promise<void> {
  await replaceLearningDocument({
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {},
    reviewActivity: null,
    settings: {},
  });
  await disconnectGithub();
  await removeLegacyLearningData();
}

// Sync is deliberately just whole-document last-write-wins. Startup, local saves,
// enabling, and the minute alarm all call the same function; overlapping calls share
// one promise. A generation change rejects results from a previous connection.

function invalidateGistSync(): void {
  generation++;
  activeSync = undefined;
}

export function sync(): Promise<void> {
  if (activeSync) {
    return activeSync;
  }

  const attempt = runSync(generation);
  activeSync = attempt;
  void attempt.finally(() => {
    if (activeSync === attempt) {
      activeSync = undefined;
    }
  });
  return attempt;
}

async function runSync(startGeneration: number): Promise<void> {
  try {
    const config = await readGistConnection();
    observedConnection ??= config;
    if (generation !== startGeneration || !config.enabled) {
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

async function syncDocument(
  config: Extract<GistSyncConfig, { gistId: string }>,
  startGeneration: number
): Promise<void> {
  const auth = await getGithubAuthorization();
  if (generation !== startGeneration || auth.account.id !== config.accountId) return;
  const github = new Octokit({ auth: auth.accessToken });
  const { data } = await github.rest.gists.get({ gist_id: config.gistId });
  if (generation !== startGeneration) return;

  const remoteFile = data.files?.[GIST_FILENAME];
  const remote = remoteFile ? await readBackupFile(remoteFile) : undefined;
  const local = await readLearningDocument();
  if (generation !== startGeneration) return;

  if (
    !remote?.dataUpdatedAt ||
    (local.dataUpdatedAt && Date.parse(local.dataUpdatedAt) > Date.parse(remote.dataUpdatedAt))
  ) {
    await github.rest.gists.update({
      gist_id: config.gistId,
      files: { [GIST_FILENAME]: { content: JSON.stringify(local, null, 2) } },
    });
  } else if (!local.dataUpdatedAt || Date.parse(local.dataUpdatedAt) < Date.parse(remote.dataUpdatedAt)) {
    await replaceLearningDocument(remote);
  }
  if (generation !== startGeneration) return;

  const timestamp = new Date().toISOString();
  await writeSyncStatus({ lastSyncTime: timestamp });
}

export async function getSyncStatus(): Promise<GistSyncStatus> {
  const status = await readSyncStatus();
  return {
    ...status,
    syncInProgress: activeSync !== undefined,
    lastError,
  };
}

export async function connectGist(setup: GistSetup): Promise<GistConnectionResult> {
  try {
    const expectedAuth = authGeneration();
    const expectedSync = generation;
    const auth = await getGithubAuthorization();
    const github = new Octokit({ auth: auth.accessToken });
    let gistId: string;

    if (setup.mode === 'existing') {
      const { data } = await github.rest.gists.get({ gist_id: setup.gistId });
      if (!data.files?.[GIST_FILENAME]) {
        return { saved: false, error: 'missingBackup' };
      }
      if (data.owner?.id !== auth.account.id) return { saved: false, error: 'authentication' };
      await readBackupFile(data.files[GIST_FILENAME]);
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

    if (expectedAuth !== authGeneration() || expectedSync !== generation) throw new Error('Connection changed');
    await saveConnection({ accountId: auth.account.id, gistId, enabled: true });
    await dismissMigrationNotice();
    return { saved: true };
  } catch (error) {
    return { saved: false, error: syncErrorCode(error, 'connectionSaveFailed') };
  }
}

export async function setSyncEnabled(enabled: boolean): Promise<GistConnectionResult> {
  try {
    const expected = authGeneration();
    const config = await readGistConnection();
    if (config.accountId === null) {
      return enabled ? { saved: false, error: 'missingToken' } : { saved: true };
    }

    if (enabled) {
      const auth = await getGithubAuthorization();
      if (auth.account.id !== config.accountId) return { saved: false, error: 'authentication' };
    }
    if (expected !== authGeneration()) throw new GithubAuthorizationError('authorization changed');
    await saveConnection({ ...config, enabled });
    return { saved: true };
  } catch (error) {
    return { saved: false, error: syncErrorCode(error, 'connectionSaveFailed') };
  }
}

function syncErrorCode(error: unknown, fallback: GistSyncErrorCode = 'unknown'): GistSyncErrorCode {
  if (error instanceof GithubAuthorizationError) return error.code;
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

// Raw Gist content is fetched only from GitHub's fixed content host, without
// authorization headers, and validated through the same versioned backup parser.
async function readBackupFile(
  file: { content?: string; truncated?: boolean; raw_url?: string } | undefined
): Promise<LearningDocument> {
  if (!file) throw new Error('Missing backup');
  let content = file.content ?? '';
  if (file.truncated) {
    const url = new URL(file.raw_url ?? '');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'gist.githubusercontent.com' ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error('Invalid Gist content URL');
    const response = await fetch(url.href, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Failed to fetch Gist content');
    content = await response.text();
  }
  return parseLearningDocumentBackup(content);
}

export async function listGistDestinations(): Promise<GistDestination[]> {
  const expected = authGeneration();
  const auth = await getGithubAuthorization();
  const github = new Octokit({ auth: auth.accessToken });
  const suggestion = await previousGist();
  const destinations: GistDestination[] = [];
  for (let page = 1; ; page++) {
    const { data } = await github.rest.gists.list({ per_page: 100, page });
    if (expected !== authGeneration()) throw new GithubAuthorizationError('authorization changed');
    for (const gist of data) {
      if (gist.owner?.id === auth.account.id && gist.files?.[GIST_FILENAME])
        destinations.push({
          id: gist.id,
          description: gist.description || gist.id,
          updatedAt: gist.updated_at,
          suggested: gist.id === suggestion,
        });
    }
    if (data.length < 100) return destinations;
  }
}

export async function disconnectGithub(): Promise<void> {
  invalidateGistSync();
  await signOutGithub();
  await removeGistConnection();
  await removeSyncStatus();
  lastError = null;
}
