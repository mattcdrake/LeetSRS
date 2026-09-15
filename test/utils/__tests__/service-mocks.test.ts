import { beforeEach, describe, expect, it } from 'vitest';
import { createMockBackground, createServiceMock } from '../service-mocks';

describe('createServiceMock', () => {
  const background = createMockBackground();
  const service = createServiceMock(background);

  beforeEach(() => {
    service.reset();
  });

  it('passes positional arguments to a handler', async () => {
    service.handle('saveNote', (frontendId, text) => {
      expect(frontendId).toBe('card-1');
      expect(text).toBe('Remember this');
    });
    await expect(background.saveNote('card-1', 'Remember this')).resolves.toBeUndefined();
  });

  it('JSON-round-trips arguments without sharing caller objects', async () => {
    const input = { frontendId: '1', domain: 'leetcode.com' as const, omitted: undefined };
    service.handle('addCard', (problem) => {
      expect(problem).toEqual({ frontendId: '1', domain: 'leetcode.com' });
      expect(problem).not.toBe(input);
      expect(problem).not.toHaveProperty('omitted');
      problem.frontendId = '2';
    });
    await background.addCard(input);
    expect(input.frontendId).toBe('1');
  });

  it('JSON-round-trips resolved responses', async () => {
    const result = { lastSyncTime: null, lastSyncDirection: 'push' as const, syncInProgress: false, lastError: null };
    service.resolve('getGistSyncStatus', Promise.resolve({ ...result, omitted: undefined }));
    const received = await background.getGistSyncStatus();
    expect(received).toEqual(result);
    expect(received).not.toBe(result);
    expect(received).not.toHaveProperty('omitted');
  });

  it.each(['throw', 'reject'])('preserves errors when handlers %s', async (mode) => {
    const error = new Error('Handler failed');
    service.handle('waitForInitialization', () => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    });
    await expect(background.waitForInitialization()).rejects.toBe(error);
  });

  it('rejects unexpected calls immediately after construction', async () => {
    const fresh = createMockBackground();
    createServiceMock(fresh);
    await expect(fresh.waitForInitialization()).rejects.toThrow('Unexpected background call: waitForInitialization');
  });
});
