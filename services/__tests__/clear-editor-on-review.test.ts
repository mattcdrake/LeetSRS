import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createEmptyCard, State as FsrsState } from 'ts-fsrs';
import { getClearEditorOnReviewDecision } from '../clear-editor-on-review';
import { serializeCard, type StoredCard } from '../cards';
import { setClearEditorOnReview } from '../settings';
import { STORAGE_KEYS } from '../storage-keys';
import type { Card } from '@/shared/cards';

describe('clear editor on review decision', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should default to not clearing when the setting is off', async () => {
    await storeCard(makeCard({ slug: 'two-sum', state: FsrsState.Review, due: new Date('2025-01-01') }));

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({ shouldClear: false });
  });

  it('should clear a due review card when the setting is enabled', async () => {
    await setClearEditorOnReview(true);
    await storeCard(
      makeCard({
        slug: 'two-sum',
        leetcodeId: '1',
        state: FsrsState.Review,
        due: new Date('2025-01-01'),
      })
    );

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({
      shouldClear: true,
      questionFrontendId: '1',
    });
  });

  it('should not clear cards that are not currently due', async () => {
    await setClearEditorOnReview(true);
    await storeCard(makeCard({ slug: 'two-sum', state: FsrsState.Review, due: new Date('2999-01-01') }));

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({ shouldClear: false });
  });

  it('should not clear unscheduled new cards', async () => {
    await setClearEditorOnReview(true);
    await storeCard(makeCard({ slug: 'two-sum', state: FsrsState.New, due: new Date('2025-01-01') }));

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({ shouldClear: false });
  });

  it.each([FsrsState.Learning, FsrsState.Relearning])(
    'should not clear a card being worked on in state %s',
    async (state) => {
      await setClearEditorOnReview(true);
      await storeCard(makeCard({ slug: 'two-sum', state, due: new Date('2025-01-01') }));

      await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({ shouldClear: false });
    }
  );

  it('should not clear paused cards', async () => {
    await setClearEditorOnReview(true);
    await storeCard(
      makeCard({
        slug: 'two-sum',
        state: FsrsState.Review,
        due: new Date('2025-01-01'),
        paused: true,
      })
    );

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({ shouldClear: false });
  });

  it('should not clear problems without a matching card', async () => {
    await setClearEditorOnReview(true);

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.com')).resolves.toEqual({ shouldClear: false });
  });

  it('should not clear a card from another LeetCode domain', async () => {
    await setClearEditorOnReview(true);
    await storeCard(makeCard({ slug: 'two-sum', state: FsrsState.Review, due: new Date('2025-01-01') }));

    await expect(getClearEditorOnReviewDecision('two-sum', 'leetcode.cn')).resolves.toEqual({ shouldClear: false });
  });
});

async function storeCard(card: Card): Promise<void> {
  const cards = ((await storage.getItem(STORAGE_KEYS.cards)) ?? {}) as Record<string, StoredCard>;
  cards[card.slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);
}

function makeCard({
  slug,
  leetcodeId = '1',
  state,
  due,
  paused = false,
}: {
  slug: string;
  leetcodeId?: string;
  state: FsrsState;
  due: Date;
  paused?: boolean;
}): Card {
  return {
    id: `${slug}-id`,
    slug,
    name: 'Two Sum',
    leetcodeId,
    difficulty: 'Easy',
    domain: 'leetcode.com',
    createdAt: new Date('2024-01-01'),
    fsrs: {
      ...createEmptyCard(),
      state,
      due,
      last_review: state === FsrsState.New ? undefined : new Date('2024-01-01'),
    },
    paused,
  };
}
