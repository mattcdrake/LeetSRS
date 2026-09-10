import { expect, it } from 'vitest';
import { getNoteStorageKey } from '../storage-keys';

it('preserves the persisted note key format', () => {
  expect(getNoteStorageKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
    'local:leetsrs:notes:a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  );
});
