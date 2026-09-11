// Outside the leetsrs: namespace collected by historical dataset readers.
export const PENDING_KEY = 'local:leetsrs-migration:pending';

interface PendingMigration {
  version: number;
  input: unknown;
}

type Json = null | boolean | string | number | Json[] | { [key: string]: Json };

// Build a detached JSON value without invoking getters or toJSON, silently
// dropping properties, filling array holes, or coercing historical values.
export function captureInput(input: unknown, ancestors = new Set<object>()): Json {
  const invalid = () => new Error('Migration recovery input must be lossless JSON');
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || Object.is(input, -0)) throw invalid();
    return input;
  }
  if (typeof input !== 'object' || ancestors.has(input)) throw invalid();
  const array = Array.isArray(input);
  const prototype: unknown = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw invalid();
  }
  ancestors.add(input);
  try {
    const keys = Reflect.ownKeys(input);
    if (array && keys.length !== input.length + 1) throw invalid();
    const entries = keys
      .filter((key) => !array || key !== 'length')
      .map((key) => {
        if (typeof key !== 'string') throw invalid();
        if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length)) throw invalid();
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw invalid();
        return [key, captureInput(descriptor.value, ancestors)] as const;
      });
    return array ? entries.map(([, value]) => value) : Object.fromEntries(entries);
  } finally {
    ancestors.delete(input);
  }
}

export function readPending(
  local: Record<string, unknown>,
  completedVersion: number,
  latestVersion: number
): PendingMigration | undefined {
  const key = PENDING_KEY.slice('local:'.length);
  if (!Object.hasOwn(local, key)) return undefined;
  const pending = captureInput(local[key]);
  if (
    pending === null ||
    typeof pending !== 'object' ||
    Array.isArray(pending) ||
    Object.keys(pending).length !== 2 ||
    !Object.hasOwn(pending, 'version') ||
    !Object.hasOwn(pending, 'input') ||
    typeof pending.version !== 'number' ||
    !Number.isInteger(pending.version) ||
    pending.version < 1 ||
    pending.version > latestVersion ||
    (pending.version !== completedVersion && pending.version !== completedVersion + 1)
  ) {
    throw new Error('Invalid migration recovery metadata: expected the completed or next supported step');
  }
  return { version: pending.version, input: pending.input };
}
