import { describe, expect, it } from 'vitest';
import { decideGistSync } from '@/background/gist-sync';

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
    });
  });

  it('pulls when the local document has no edit timestamp', () => {
    expect(decideGistSync({ state: 'parsed', dataUpdatedAt: earlier }, undefined)).toEqual({ action: 'pull' });
  });

  it.each([undefined, earlier])('pushes when the remote timestamp is absent and local is %s', (local) => {
    expect(decideGistSync({ state: 'parsed', dataUpdatedAt: undefined }, local)).toEqual({ action: 'push' });
  });
});
