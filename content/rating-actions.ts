import type { Grade } from 'ts-fsrs';
import { sendMessage } from '@/infrastructure/browser/messages';
import { getCurrentProblem } from './problem-data';

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
