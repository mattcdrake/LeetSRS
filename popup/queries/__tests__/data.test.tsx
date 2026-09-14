/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { createDailyStats } from '@/background/statistics';
import { sendMessage } from '@/shared/messages';
import { replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useExportDataMutation } from '../data';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));
beforeEach(() => fakeBrowser.reset());

it('exports the current complete snapshot, preserving its timestamp and excluding connection, status, and legacy values', async () => {
  const document = buildLearningDocument({
    cards: { 'two-sum': createMockCard(State.Review, { slug: 'two-sum', paused: true, note: 'Keep this note' }) },
    stats: { '2024-01-01': createDailyStats(undefined) },
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
  vi.mocked(sendMessage).mockRejectedValue(new Error('Initialization failed'));
  const { result } = renderHook(() => useExportDataMutation(), { wrapper: createPopupTestWrapper().wrapper });
  await act(async () => expect(result.current.mutateAsync()).rejects.toThrow('Initialization failed'));
  expect(result.current.data).toBeUndefined();
  expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toBeNull();
});
