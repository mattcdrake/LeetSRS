import { beforeEach, expect, it, vi } from 'vitest';
import { getCurrentProblem } from '@/content/problem-data';
import { sendMessage } from '@/shared/messages';
import { buildProblem } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { addCurrentProblem, rateCurrentProblem } from '../rating-actions';

vi.mock('@/content/problem-data', () => ({ getCurrentProblem: vi.fn() }));
vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

const messages = createMessageMock(vi.mocked(sendMessage));
const problem = buildProblem();
beforeEach(() => {
  messages.reset().resolve('rateCard', undefined).resolve('addCard', undefined);
  vi.mocked(getCurrentProblem).mockResolvedValue(problem);
});

it('reads the current problem again for each action', async () => {
  const nextProblem = buildProblem({ frontendId: '15' });
  vi.mocked(getCurrentProblem).mockResolvedValueOnce(problem).mockResolvedValueOnce(nextProblem);

  await rateCurrentProblem(3);
  await addCurrentProblem();

  expect(sendMessage).toHaveBeenNthCalledWith(1, 'rateCard', {
    input: { frontendId: problem.frontendId, domain: problem.domain, rating: 3 },
  });
  expect(sendMessage).toHaveBeenNthCalledWith(2, 'addCard', {
    problem: { frontendId: nextProblem.frontendId, domain: nextProblem.domain },
  });
});

it.each([
  ['rate', () => rateCurrentProblem(3)],
  ['add', addCurrentProblem],
] as const)('does not %s when the current problem is unavailable', async (_name, action) => {
  vi.mocked(getCurrentProblem).mockRejectedValue(new Error('Unknown problem'));

  await expect(action()).rejects.toThrow('Unknown problem');

  expect(sendMessage).not.toHaveBeenCalled();
});
