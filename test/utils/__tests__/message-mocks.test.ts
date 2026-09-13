import { Rating, State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/infrastructure/browser/messages';
import { buildProblem } from '@/test/utils/card-mocks';
import { createMockCard } from '../card-mocks';
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
    const card = createMockCard(State.New, { note: 'Remember this' });
    const result = [{ ...card, omitted: undefined }];
    messages.resolve('rateCard', Promise.resolve({ card: result[0], shouldRequeue: false }));

    const received = await sendMessage('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });

    expect(received).toEqual({ card, shouldRequeue: false });
    expect(received).not.toBe(result);
    expect(received.card).not.toBe(result[0]);
    expect(received.card).not.toHaveProperty('omitted');
  });

  it.each(['throw', 'reject'])('preserves errors when handlers %s', async (mode) => {
    const error = new Error('Handler failed');
    messages.handle('rateCard', () => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    });

    await expect(sendMessage('rateCard', { input: { ...buildProblem(), rating: Rating.Good } })).rejects.toBe(error);
  });

  it('rejects unexpected messages', async () => {
    await expect(sendMessage('rateCard', { input: { ...buildProblem(), rating: Rating.Good } })).rejects.toThrow(
      'Unexpected extension message: rateCard'
    );
  });
});
