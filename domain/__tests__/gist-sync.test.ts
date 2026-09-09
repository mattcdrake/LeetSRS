import { describe, expect, it } from 'vitest';
import { decideGistSync } from '../gist-sync';

const earlier = '2024-01-15T10:00:00Z';
const later = '2024-01-16T10:00:00Z';

describe('decideGistSync', () => {
  it.each([
    { local: later, remote: earlier, action: 'push' },
    { local: earlier, remote: later, action: 'pull' },
    { local: earlier, remote: earlier, action: 'no-change' },
    { local: earlier, remote: '2024-01-15T02:00:00-08:00', action: 'no-change' },
    { local: 'invalid', remote: earlier, action: 'no-change' },
    { local: earlier, remote: 'invalid', action: 'no-change' },
    { local: 'invalid', remote: 'invalid', action: 'no-change' },
  ])('returns $action for local $local and remote $remote', ({ local, remote, action }) => {
    expect(decideGistSync({ state: 'parsed', dataUpdatedAt: remote }, local)).toEqual({
      action,
      initializeDataUpdatedAt: false,
    });
  });

  it.each([null, undefined, ''])('handles missing local timestamp %s', (local) => {
    for (const remote of [earlier, 'invalid']) {
      expect(decideGistSync({ state: 'parsed', dataUpdatedAt: remote }, local)).toEqual({
        action: 'pull',
        initializeDataUpdatedAt: false,
      });
    }
  });

  it.each([null, undefined, ''])('handles missing parsed remote timestamp %s', (remote) => {
    for (const local of [null, undefined, '', earlier, 'invalid']) {
      expect(decideGistSync({ state: 'parsed', dataUpdatedAt: remote }, local)).toEqual({
        action: 'push',
        initializeDataUpdatedAt: !local,
      });
    }
  });

  it.each(['missing', 'invalid-json'] as const)('pushes %s content without initialization', (state) => {
    for (const local of [null, undefined, '', earlier, 'invalid']) {
      expect(decideGistSync({ state }, local)).toEqual({
        action: 'push',
        initializeDataUpdatedAt: false,
      });
    }
  });
});
