import { assert } from 'vitest';

export function requireDefined<T>(value: T | null | undefined, message = 'Expected value to be defined'): T {
  assert(value !== null && value !== undefined, message);
  return value;
}
