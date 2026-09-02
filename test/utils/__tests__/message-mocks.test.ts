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
    messages.resolve('exportData', '{"version":1}');

    await expect(sendMessage('exportData')).resolves.toBe('{"version":1}');
  });

  it('passes typed message data to a handler', async () => {
    messages.handle('saveNote', ({ cardId, text }) => {
      expect(cardId).toBe('card-1');
      expect(text).toBe('Remember this');
    });

    await sendMessage('saveNote', { cardId: 'card-1', text: 'Remember this' });
  });

  it('rejects unexpected messages', async () => {
    await expect(sendMessage('getAllCards')).rejects.toThrow('Unexpected extension message: getAllCards');
  });
});
