/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { background } from '@/shared/background-service';

import { replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useExportDataMutation } from '../data';

vi.mock('@/shared/background-service', async (importOriginal) => {
  const { createMockBackground } = await import('@/test/utils/service-mocks');
  return {
    ...(await importOriginal<typeof import('@/shared/background-service')>()),
    background: createMockBackground(),
  };
});
beforeEach(() => fakeBrowser.reset());

it('exports the current complete snapshot, preserving its timestamp and excluding connection, status, and legacy values', async () => {
  const document = buildLearningDocument({
    cards: { '1': createMockCard(State.Review, { frontendId: '1', paused: true, note: 'Keep this note' }) },
    reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 },
    settings: { theme: 'dark', maxNewCardsPerDay: 7, resetEditorOnReviewQueue: true },
    dataUpdatedAt: '2024-01-15T10:00:00.000Z',
  });
  await replaceLearningDocument(document);
  await storage.setItems([
    { key: STORAGE_KEYS.gistConnection, value: { pat: 'private-pat', gistId: 'local-gist', enabled: true } },
    { key: STORAGE_KEYS.lastSyncTime, value: 'previous-sync' },
    { key: STORAGE_KEYS.lastSyncDirection, value: 'pull' },
    { key: 'sync:leetsrs:theme', value: 'light' },
  ]);
  const { result } = renderHook(() => useExportDataMutation(), { wrapper: createPopupTestWrapper().wrapper });
  await act(async () => expect(JSON.parse(await result.current.mutateAsync())).toEqual(document));

  const replacement = buildLearningDocument();
  await replaceLearningDocument(replacement);
  await act(async () => expect(JSON.parse(await result.current.mutateAsync())).toEqual(replacement));
});

it('reports initialization failure when exporting unavailable data without creating an empty backup', async () => {
  vi.mocked(background.waitForInitialization).mockRejectedValue(new Error('Initialization failed'));
  const { result } = renderHook(() => useExportDataMutation(), { wrapper: createPopupTestWrapper().wrapper });
  await act(async () => expect(result.current.mutateAsync()).rejects.toThrow('Initialization failed'));
  expect(result.current.data).toBeUndefined();
  expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toBeNull();
});
