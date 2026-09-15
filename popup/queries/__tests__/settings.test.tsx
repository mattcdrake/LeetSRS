/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { updateSettings } from '@/background/learning';
import { background } from '@/shared/background-service';

import { readLearningDocument, replaceLearningDocument } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useSettingsQuery, useUpdateSettingsMutation } from '../settings';

vi.mock('@/shared/background-service', async (importOriginal) => {
  const { createMockBackground } = await import('@/test/utils/service-mocks');
  return {
    ...(await importOriginal<typeof import('@/shared/background-service')>()),
    background: createMockBackground(),
  };
});

describe('popup settings with the prepared document workflows', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    const messages = createServiceMock(background);
    messages.reset().handle('updateSettings', updateSettings);
    await replaceLearningDocument(buildLearningDocument());
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads defaults, displays saved edits, and reloads replaced overrides through the existing commands', async () => {
    const { wrapper } = createPopupTestWrapper();
    const { result } = renderHook(() => ({ settings: useSettingsQuery(), update: useUpdateSettingsMutation() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current?.settings.data.theme).toBe('system'));
    expect((await readLearningDocument())?.settings).toEqual({});

    await act(() => result.current.update.mutateAsync({ theme: 'dark' }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('dark'));
    expect((await readLearningDocument())?.settings).toEqual({ theme: 'dark' });

    await replaceLearningDocument(buildLearningDocument({ settings: { maxNewCardsPerDay: 0 } }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('system'));
    expect(result.current.settings.data.maxNewCardsPerDay).toBe(0);
  });

  it('reports a rejected save while retaining displayed and stored settings, then allows retry', async () => {
    const { wrapper } = createPopupTestWrapper();
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
