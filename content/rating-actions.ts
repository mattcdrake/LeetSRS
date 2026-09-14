import type { Grade } from 'ts-fsrs';
import { getCurrentProblem } from '@/content/problem-data';
import { sendMessage } from '@/shared/messages';

export async function rateCurrentProblem(rating: Grade) {
  const problem = await getCurrentProblem();
  if (!problem) return;

  await sendMessage('rateCard', {
    input: { ...problem, rating },
  });
}

export async function addCurrentProblem() {
  const problem = await getCurrentProblem();
  if (!problem) return;

  await sendMessage('addCard', { problem });
}
