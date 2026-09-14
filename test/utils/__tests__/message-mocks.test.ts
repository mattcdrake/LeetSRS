import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messages';
import { createMessageMock } from '../message-mocks';

vi.mock('@/shared/messages', () => ({
  sendMessage: vi.fn(),
}));

describe('createMessageMock', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset();
  });

  it('returns a configured protocol result', async () => {
    messages.handle('waitForInitialization', (data) => {
      expect(data).toBeUndefined();
      return undefined;
    });

    await expect(sendMessage('waitForInitialization')).resolves.toBe(undefined);
  });

  it('passes typed message data to a handler', async () => {
    const input = { slug: 'card-1', text: 'Remember this', omitted: undefined };
    messages.handle('saveNote', (data) => {
      expect(data).toEqual({ slug: 'card-1', text: 'Remember this' });
      expect(data).not.toBe(input);
      expect(data).not.toHaveProperty('omitted');
      data.text = 'Changed by handler';
    });

    await expect(sendMessage('saveNote', input)).resolves.toBeUndefined();
    expect(input.text).toBe('Remember this');
  });

  it('JSON-round-trips resolved responses', async () => {
    const result = { lastSyncTime: null, lastSyncDirection: 'push' as const, syncInProgress: false, lastError: null };
    messages.resolve('getGistSyncStatus', Promise.resolve({ ...result, omitted: undefined }));

    const received = await sendMessage('getGistSyncStatus');

    expect(received).toEqual(result);
    expect(received).not.toBe(result);
    expect(received).not.toHaveProperty('omitted');
  });

  it.each(['throw', 'reject'])('preserves errors when handlers %s', async (mode) => {
    const error = new Error('Handler failed');
    messages.handle('waitForInitialization', () => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    });

    await expect(sendMessage('waitForInitialization')).rejects.toBe(error);
  });

  it('rejects unexpected messages', async () => {
    await expect(sendMessage('waitForInitialization')).rejects.toThrow(
      'Unexpected extension message: waitForInitialization'
    );
  });
});
