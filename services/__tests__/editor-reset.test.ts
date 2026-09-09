import { createEmptyCard, State as FsrsState } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { Card } from '@/domain/cards';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { shouldResetEditor } from '../editor-reset';
import { updateSettings } from '../settings';

describe('shouldResetEditor', () => {
  beforeEach(() => fakeBrowser.reset());

  it('resets every problem when the global setting is enabled', async () => {
    await updateSettings({ resetEditorOnEveryProblem: true });
    await expect(shouldResetEditor('two-sum', 'leetcode.com')).resolves.toBe(true);
  });

  it.each([FsrsState.New, FsrsState.Learning, FsrsState.Review, FsrsState.Relearning])(
    'resets a due card in state %s',
    async (state) => {
      await updateSettings({ resetEditorOnDueReview: true });
      await storeCard(makeCard({ state }));
      await expect(shouldResetEditor('two-sum', 'leetcode.com')).resolves.toBe(true);
    }
  );

  it.each([
    ['disabled', {}, false],
    ['not due', { due: new Date('2999-01-01') }, true],
    ['paused', { paused: true }, true],
  ])('does not reset a %s card', async (_name, overrides, enableSetting) => {
    if (enableSetting) await updateSettings({ resetEditorOnDueReview: true });
    await storeCard(makeCard(overrides));
    await expect(shouldResetEditor('two-sum', 'leetcode.com')).resolves.toBe(false);
  });

  it('does not reset a card from the other LeetCode domain', async () => {
    await updateSettings({ resetEditorOnDueReview: true });
    await storeCard(makeCard());
    await expect(shouldResetEditor('two-sum', 'leetcode.cn')).resolves.toBe(false);
  });
});

async function storeCard(card: Card): Promise<void> {
  await storage.setItem(STORAGE_KEYS.cards, { [card.slug]: card });
}

function makeCard(overrides: Partial<{ due: Date; state: FsrsState; paused: boolean }> = {}): Card {
  const state = overrides.state ?? FsrsState.Review;
  return {
    id: 'two-sum-id',
    slug: 'two-sum',
    name: 'Two Sum',
    leetcodeId: '1',
    difficulty: 'Easy',
    domain: 'leetcode.com',
    createdAt: new Date('2024-01-01').getTime(),
    fsrs: {
      ...createEmptyCard(),
      state,
      due: (overrides.due ?? new Date('2025-01-01')).getTime(),
      last_review: state === FsrsState.New ? undefined : new Date('2024-01-01').getTime(),
    },
    paused: overrides.paused ?? false,
  };
}
