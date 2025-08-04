import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS, getNoteStorageKey } from '../storage-keys';

describe('Storage Keys', () => {
  describe('getNoteStorageKey', () => {
    it('should handle UUID-style card IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const key = getNoteStorageKey(uuid);

      expect(key).toBe(`${STORAGE_KEYS.notes}:${uuid}`);
    });

    it('should generate consistent keys for the same card', () => {
      const cardId = 'consistent-card';
      const key1 = getNoteStorageKey(cardId);
      const key2 = getNoteStorageKey(cardId);
      const key3 = getNoteStorageKey(cardId);

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('should handle very long card IDs', () => {
      const longId = 'a'.repeat(100);
      const key = getNoteStorageKey(longId);

      expect(key).toBe(`local:leetreps:notes:${longId}`);
      expect(key.length).toBe('local:leetreps:notes:'.length + 100);
    });
  });
});
