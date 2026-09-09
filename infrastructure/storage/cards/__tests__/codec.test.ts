import { createEmptyCard, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { Card } from '@/domain/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { deserializeCard, type StoredCard, serializeCard } from '../codec';

describe('Card serialization', () => {
  describe('serializeCard', () => {
    it('should convert Date to timestamp', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const card: Card = {
        id: 'test-id-1',
        slug: 'two-sum',
        name: 'Two Sum',
        leetcodeId: '1',
        difficulty: 'Easy',
        createdAt: testDate,
        fsrs: createEmptyCard(),
        paused: false,
        domain: 'leetcode.com',
      };

      const serialized = serializeCard(card);

      expect(serialized.slug).toBe('two-sum');
      expect(serialized.name).toBe('Two Sum');
      expect(serialized.createdAt).toBe(testDate.getTime());
      expect(typeof serialized.createdAt).toBe('number');
    });

    it('should serialize FSRS card dates', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const fsrsCard = createEmptyCard();
      fsrsCard.last_review = new Date('2024-01-14T09:00:00Z');

      const card: Card = {
        id: 'test-id-2',
        slug: 'two-sum',
        name: 'Two Sum',
        leetcodeId: '1',
        difficulty: 'Medium',
        createdAt: testDate,
        fsrs: fsrsCard,
        paused: false,
        domain: 'leetcode.com',
      };

      const serialized = serializeCard(card);

      expect(typeof serialized.fsrs.due).toBe('number');
      expect(serialized.fsrs.due).toBe(fsrsCard.due.getTime());
      expect(typeof serialized.fsrs.last_review).toBe('number');
      expect(serialized.fsrs.last_review).toBe(fsrsCard.last_review.getTime());
      expect(serialized.fsrs.stability).toBe(fsrsCard.stability);
      expect(serialized.fsrs.difficulty).toBe(fsrsCard.difficulty);
    });
  });

  describe('deserializeCard', () => {
    it('should convert timestamp back to Date object', () => {
      const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
      const emptyFsrs = createEmptyCard();
      const storedCard: StoredCard = {
        id: 'test-id-3',
        slug: 'merge-intervals',
        name: 'Merge Intervals',
        leetcodeId: '56',
        difficulty: 'Hard',
        createdAt: timestamp,
        fsrs: {
          ...emptyFsrs,
          due: emptyFsrs.due.getTime(),
          last_review: emptyFsrs.last_review?.getTime(),
        },
        paused: false,
        domain: 'leetcode.com',
      };

      const deserialized = deserializeCard(storedCard);

      expect(deserialized.slug).toBe('merge-intervals');
      expect(deserialized.name).toBe('Merge Intervals');
      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.createdAt.getTime()).toBe(timestamp);
    });

    it.each([undefined, 0, 1705222800000])('round-trips last_review %s', (lastReview) => {
      const card = createMockCard(State.Review);
      card.fsrs.last_review = lastReview === undefined ? undefined : new Date(lastReview);
      expect(deserializeCard(serializeCard(card))).toEqual(card);
    });

    it('should default domain to leetcode.com when missing', () => {
      const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
      const emptyFsrs = createEmptyCard();
      // Simulate a pre-migration stored card that lacks the domain field
      const storedCard = {
        id: 'test-id-old',
        slug: 'old-problem',
        name: 'Old Problem',
        leetcodeId: '100',
        difficulty: 'Easy',
        createdAt: timestamp,
        fsrs: {
          ...emptyFsrs,
          due: emptyFsrs.due.getTime(),
          last_review: emptyFsrs.last_review?.getTime(),
        },
        paused: false,
      } as unknown as StoredCard;

      const deserialized = deserializeCard(storedCard);

      expect(deserialized.domain).toBe('leetcode.com');
    });
  });

  describe('serializeCard and deserializeCard roundtrip', () => {
    it('should maintain data integrity through serialization and deserialization', () => {
      const originalCard: Card = {
        id: 'test-id-4',
        slug: 'two-pointers',
        name: 'Two Pointers',
        leetcodeId: '999',
        difficulty: 'Medium',
        createdAt: new Date(),
        fsrs: createEmptyCard(),
        paused: false,
        domain: 'leetcode.com',
      };

      const serialized = serializeCard(originalCard);
      const deserialized = deserializeCard(serialized);

      expect(deserialized.slug).toBe(originalCard.slug);
      expect(deserialized.name).toBe(originalCard.name);
      expect(deserialized.createdAt.getTime()).toBe(originalCard.createdAt.getTime());
    });
  });
});
