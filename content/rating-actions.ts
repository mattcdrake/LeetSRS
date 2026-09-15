import type { Grade } from 'ts-fsrs';
import { getCurrentProblem } from '@/content/problem-data';
import { sendMessage } from '@/shared/messages';

export async function rateCurrentProblem(rating: Grade) {
  const problem = await getCurrentProblem();

  await sendMessage('rateCard', {
    input: { frontendId: problem.frontendId, domain: problem.domain, rating },
  });
}

export async function addCurrentProblem() {
  const problem = await getCurrentProblem();

  await sendMessage('addCard', { problem: { frontendId: problem.frontendId, domain: problem.domain } });
}
