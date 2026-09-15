// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addCurrentProblem, rateCurrentProblem } from '@/content/rating-actions';
import background from '@/entrypoints/background/index';
import { onMessage, sendMessage } from '@/shared/messages';
import { createMessageMock } from '@/test/utils/message-mocks';

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  onMessage: vi.fn(),
  sendMessage: vi.fn(),
}));

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  background.main();
  const messages = createMessageMock(vi.mocked(sendMessage)).reset();
  for (const [name, listener] of vi.mocked(onMessage).mock.calls) {
    messages.handle(name, (data) => listener({ id: 1, type: name, data, timestamp: 0, sender: {} }));
  }
  await sendMessage('waitForInitialization');
  Object.defineProperty(window, 'location', {
    value: { pathname: '/problems/two-sum/', hostname: 'leetcode.com' },
    writable: true,
  });
  vi.mocked(sendMessage).mockClear();
  vi.mocked(fetch).mockClear();
});

describe.each([
  {
    name: 'rate',
    action: () => rateCurrentProblem(3),
    command: 'rateCard',
    firstPayload: { input: { frontendId: '1', domain: 'leetcode.com', rating: 3 } },
    nextPayload: { input: { frontendId: '2', domain: 'leetcode.cn', rating: 3 } },
  },
  {
    name: 'add',
    action: addCurrentProblem,
    command: 'addCard',
    firstPayload: { problem: { frontendId: '1', domain: 'leetcode.com' } },
    nextPayload: { problem: { frontendId: '2', domain: 'leetcode.cn' } },
  },
] as const)('$name current problem', ({ action, command, firstPayload, nextPayload }) => {
  it('uses fresh page context for each action across both LeetCode domains', async () => {
    await action();

    expect(sendMessage).toHaveBeenLastCalledWith(command, firstPayload);

    window.location.pathname = '/problems/add-two-numbers/';
    window.location.hostname = 'leetcode.cn';
    await action();

    expect(sendMessage).toHaveBeenCalledWith('getProblem', { slug: 'two-sum', domain: 'leetcode.com' });
    expect(sendMessage).toHaveBeenCalledWith('getProblem', { slug: 'add-two-numbers', domain: 'leetcode.cn' });
    expect(sendMessage).toHaveBeenLastCalledWith(command, nextPayload);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects without sending a command when no problem slug exists', async () => {
    window.location.pathname = '/home';

    await expect(action()).rejects.toThrow('Expected a problem slug on the current page');

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each(['unknown-problem', 'com-only'])('rejects an unknown or unavailable problem: %s', async (slug) => {
    window.location.pathname = `/problems/${slug}/`;
    window.location.hostname = 'leetcode.cn';

    await expect(action()).rejects.toThrow('Unknown problem');

    expect(sendMessage).toHaveBeenCalledExactlyOnceWith('getProblem', { slug, domain: 'leetcode.cn' });
  });
});
