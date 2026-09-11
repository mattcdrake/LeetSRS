import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '../message-mocks';

vi.mock('@/infrastructure/browser/messages', () => ({
  sendMessage: vi.fn(),
}));

describe('createMessageMock', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset();
  });

  it('returns a configured protocol result', async () => {
    messages.handle('exportData', (data) => {
      expect(data).toBeUndefined();
      return '{"version":1}';
    });

    await expect(sendMessage('exportData')).resolves.toBe('{"version":1}');
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
    const result = { slug: 'card-1', text: 'Remember this', omitted: undefined };
    messages.resolve('getNote', Promise.resolve(result));

    const received = await sendMessage('getNote', { slug: 'card-1' });

    expect(received).toEqual({ slug: 'card-1', text: 'Remember this' });
    expect(received).not.toBe(result);
    expect(received).not.toHaveProperty('omitted');
  });

  it.each(['throw', 'reject'])('preserves errors when handlers %s', async (mode) => {
    const error = new Error('Handler failed');
    messages.handle('getAllCards', () => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    });

    await expect(sendMessage('getAllCards')).rejects.toBe(error);
  });

  it('rejects unexpected messages', async () => {
    await expect(sendMessage('getAllCards')).rejects.toThrow('Unexpected extension message: getAllCards');
  });
});
