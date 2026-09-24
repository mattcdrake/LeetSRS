import { expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getGithubAuthStatus } from '@/background/github-auth';
import { dismissMigrationNotice, migratePatConnection } from '@/background/legacy/github-pat';
import { patMigrationItem } from '@/shared/legacy/github-pat';
import { readGistConnection, readLearningDocument, replaceLearningDocument } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

it('retires current and legacy PATs permanently while preserving learning data and a dismissed suggestion', async () => {
  await replaceLearningDocument(buildLearningDocument());
  const before = await readLearningDocument();
  await fakeBrowser.storage.sync.set({
    'leetsrs:gistConnection': { pat: 'secret', gistId: 'previous', enabled: true },
    'leetsrs:githubPat': 'older',
    'leetsrs:gistId': 'older-gist',
  });
  await migratePatConnection();
  expect(await fakeBrowser.storage.sync.get()).toEqual({});
  expect((await getGithubAuthStatus()).migrationNotice).toBe(true);
  expect((await readGistConnection()).enabled).toBe(false);
  await dismissMigrationNotice();
  await fakeBrowser.storage.sync.set({ 'leetsrs:githubPat': 'resurrected' });
  await migratePatConnection();
  expect((await getGithubAuthStatus()).migrationNotice).toBe(false);
  expect(await patMigrationItem.getValue()).toEqual({ notice: false, previousGist: 'previous' });
  expect(await readLearningDocument()).toEqual(before);
  expect(await fakeBrowser.storage.sync.get()).toEqual({});
});
