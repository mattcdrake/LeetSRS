import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { sendMessage } from '@/infrastructure/browser/messages';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { getCurrentProblem } from '../problem-data';
import { addCurrentProblem, rateCurrentProblem } from '../rating-actions';

vi.mock('../problem-data', () => ({ getCurrentProblem: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

const messages = createMessageMock(vi.mocked(sendMessage));
const problem = buildProblem();
const card = createMockCard(State.New);

beforeEach(() => {
  messages.reset().resolve('rateCard', { card, shouldRequeue: false }).resolve('addCard', card);
  vi.mocked(getCurrentProblem).mockResolvedValue(problem);
});

it.each([1, 2, 3, 4])('rates the current problem with grade %i', async (rating) => {
  await rateCurrentProblem(rating);

  expect(getCurrentProblem).toHaveBeenCalledOnce();
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith('rateCard', {
    input: { ...problem, rating },
  });
});

it('adds the current problem without a rating', async () => {
  await addCurrentProblem();

  expect(getCurrentProblem).toHaveBeenCalledOnce();
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith('addCard', { problem });
});

it('reads the current problem again for each action', async () => {
  const nextProblem = buildProblem({ slug: 'three-sum', name: '3Sum', leetcodeId: '15' });
  vi.mocked(getCurrentProblem).mockResolvedValueOnce(problem).mockResolvedValueOnce(nextProblem);

  await rateCurrentProblem(3);
  await addCurrentProblem();

  expect(sendMessage).toHaveBeenNthCalledWith(1, 'rateCard', { input: { ...problem, rating: 3 } });
  expect(sendMessage).toHaveBeenNthCalledWith(2, 'addCard', { problem: nextProblem });
});

it.each([
  ['rate', () => rateCurrentProblem(3)],
  ['add', addCurrentProblem],
] as const)('does not %s when the current problem is unavailable', async (_name, action) => {
  vi.mocked(getCurrentProblem).mockResolvedValue(null);

  await action();

  expect(sendMessage).not.toHaveBeenCalled();
});
