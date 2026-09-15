// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getCurrentProblem } from '@/content/problem-data';
import background from '@/entrypoints/background/index';
import { onMessage, sendMessage } from '@/shared/messages';
import { buildProblemDescriptor } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  onMessage: vi.fn(),
  sendMessage: vi.fn(),
}));

const problem = buildProblemDescriptor();

describe('getCurrentProblem', () => {
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
      value: { pathname: `/problems/${problem.slug}/`, hostname: 'leetcode.com' },
      writable: true,
    });
    vi.mocked(fetch).mockClear();
  });

  it('rejects when no problem slug exists', async () => {
    window.location.pathname = '/home';
    await expect(getCurrentProblem()).rejects.toThrow('Expected a problem slug on the current page');
  });

  it.each([
    ['leetcode.com', problem.name],
    ['leetcode.cn', '两数之和'],
  ] as const)('reads the bundled problem on %s through background messaging', async (domain, name) => {
    window.location.hostname = domain;
    expect(await getCurrentProblem()).toEqual({ ...problem, domain, name });
    expect(sendMessage).toHaveBeenLastCalledWith('getProblem', { slug: problem.slug, domain });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['unknown-problem', 'com-only'])('rejects an unknown or unavailable problem: %s', async (slug) => {
    window.location.pathname = `/problems/${slug}/`;
    window.location.hostname = 'leetcode.cn';
    await expect(getCurrentProblem()).rejects.toThrow('Unknown problem');
  });
});
