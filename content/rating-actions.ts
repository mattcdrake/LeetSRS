import type { Grade } from 'ts-fsrs';
import { sendMessage } from '@/integrations/browser/messages';
import { getCurrentProblem } from '../integrations/leetcode/problem-data';

export async function saveCurrentProblem(rating?: Grade): Promise<void> {
  const problem = await getCurrentProblem();
  if (!problem) throw new Error('Current problem is unavailable');

  if (rating === undefined) await sendMessage('addCard', { problem });
  else await sendMessage('rateCard', { input: { ...problem, rating } });
}
