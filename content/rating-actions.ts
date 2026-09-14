import type { Rating } from '@/domain/ratings';
import { sendMessage } from '@/integrations/browser/messages';
import { getCurrentProblem } from '../integrations/leetcode/problem-data';

export async function rateCurrentProblem(rating: Rating) {
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
