/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { cardQueryKeys } from '../cards';
import { settingsQueryKeys, useUpdateSettingsMutation } from '../settings';
import { statsQueryKeys } from '../stats';

vi.mock('@/shared/messages', () => ({
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
  await expectInvalidations({ dayStartHour: 4 }, [settingsQueryKeys.all, cardQueryKeys.all, statsQueryKeys.all]);
});
