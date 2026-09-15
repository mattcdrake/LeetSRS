// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addCurrentProblem, rateCurrentProblem } from '@/content/rating-actions';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { getRegisteredBackground } from '@/test/utils/background-service';

import { createServiceMock } from '@/test/utils/service-mocks';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  backgroundEntry.main();
  const service = createServiceMock(background).reset();
  service.use(getRegisteredBackground());
  await background.waitForInitialization();
  Object.defineProperty(window, 'location', {
    value: { pathname: '/problems/two-sum/', hostname: 'leetcode.com' },
    writable: true,
  });
  for (const method of Object.values(background)) vi.mocked(method).mockClear();
  vi.mocked(fetch).mockClear();
});

describe.each([
  {
    name: 'rate',
    action: () => rateCurrentProblem(3),
    command: 'rateCard',
    firstArgument: { frontendId: '1', domain: 'leetcode.com', rating: 3 },
    nextArgument: { frontendId: '2', domain: 'leetcode.cn', rating: 3 },
  },
  {
    name: 'add',
    action: addCurrentProblem,
    command: 'addCard',
    firstArgument: { frontendId: '1', domain: 'leetcode.com' },
    nextArgument: { frontendId: '2', domain: 'leetcode.cn' },
  },
] as const)('$name current problem', ({ action, command, firstArgument, nextArgument }) => {
  it('uses fresh page context for each action across both LeetCode domains', async () => {
    await action();

    expect(background[command]).toHaveBeenLastCalledWith(firstArgument);

    window.location.pathname = '/problems/add-two-numbers/';
    window.location.hostname = 'leetcode.cn';
    await action();

    expect(background.getProblem).toHaveBeenCalledWith('two-sum', 'leetcode.com');
    expect(background.getProblem).toHaveBeenCalledWith('add-two-numbers', 'leetcode.cn');
    expect(background[command]).toHaveBeenLastCalledWith(nextArgument);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects without sending a command when no problem slug exists', async () => {
    window.location.pathname = '/home';

    await expect(action()).rejects.toThrow('Expected a problem slug on the current page');

    expect(Object.values(background).flatMap((method) => vi.mocked(method).mock.calls)).toHaveLength(0);
  });

  it.each(['unknown-problem', 'com-only'])('rejects an unknown or unavailable problem: %s', async (slug) => {
    window.location.pathname = `/problems/${slug}/`;
    window.location.hostname = 'leetcode.cn';

    await expect(action()).rejects.toThrow('Unknown problem');

    expect(background.getProblem).toHaveBeenCalledExactlyOnceWith(slug, 'leetcode.cn');
  });
});
