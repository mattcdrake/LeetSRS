/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sendMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { getSettings, updateSettings } from '@/services/document-settings';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { cardQueryKeys } from '../cards';
import { settingsQueryKeys, useSettingsQuery, useUpdateSettingsMutation } from '../settings';

vi.mock('@/infrastructure/browser/messages', () => ({
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

it('invalidates only the queries affected by each settings change', async () => {
  const { wrapper, queryClient } = createTestWrapper();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const { result } = renderHook(() => useUpdateSettingsMutation(), { wrapper });

  const expectInvalidations = async (changes: Parameters<typeof result.current.mutateAsync>[0], keys: unknown[]) => {
    invalidateQueries.mockClear();
    await act(() => result.current.mutateAsync(changes));
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual(keys.map((queryKey) => ({ queryKey })));
  };

  await expectInvalidations({ theme: 'dark' }, [settingsQueryKeys.all]);
  await expectInvalidations({ maxNewCardsPerDay: 10 }, [settingsQueryKeys.all, cardQueryKeys.all]);
});

describe('popup settings with the prepared document workflows', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    const messages = createMessageMock(vi.mocked(sendMessage));
    messages
      .reset()
      .handle('getSettings', getSettings)
      .handle('updateSettings', ({ changes }) => updateSettings(changes));
    await replaceLearningDocument({ schemaVersion: 6, cards: {}, stats: {}, settings: {} });
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads defaults, displays saved edits, and reloads replaced overrides through the existing commands', async () => {
    const { wrapper, queryClient } = createTestWrapper();
    const { result } = renderHook(() => ({ settings: useSettingsQuery(), update: useUpdateSettingsMutation() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current?.settings.data.theme).toBe('system'));
    expect((await readLearningDocument())?.settings).toEqual({});

    await act(() => result.current.update.mutateAsync({ theme: 'dark' }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('dark'));
    expect((await readLearningDocument())?.settings).toEqual({ theme: 'dark' });

    await replaceLearningDocument({ schemaVersion: 6, cards: {}, stats: {}, settings: { maxNewCardsPerDay: 0 } });
    await act(() => queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('system'));
    expect(result.current.settings.data.maxNewCardsPerDay).toBe(0);
  });

  it('reports a rejected save while retaining displayed and stored settings, then allows retry', async () => {
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => ({ settings: useSettingsQuery(), update: useUpdateSettingsMutation() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current?.settings.data.theme).toBe('system'));
    const failure = new Error('Storage unavailable');
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(failure);

    await act(async () => {
      await expect(result.current.update.mutateAsync({ theme: 'dark' })).rejects.toBe(failure);
    });
    await waitFor(() => expect(result.current.update.error).toBe(failure));
    expect(result.current.settings.data.theme).toBe('system');
    expect((await readLearningDocument())?.settings).toEqual({});

    await act(() => result.current.update.mutateAsync({ theme: 'dark' }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('dark'));
    expect((await readLearningDocument())?.settings).toEqual({ theme: 'dark' });
  });
});
