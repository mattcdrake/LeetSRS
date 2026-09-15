import type { Grade } from 'ts-fsrs';
import { getCurrentDomain, getCurrentProblemSlug } from '@/content/page-context';
import { catalogQuestionSchema } from '@/shared/catalog';
import { sendMessage } from '@/shared/messages';
import type { ProblemReference } from '@/shared/models';

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

async function getCurrentProblem(): Promise<ProblemReference> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  const domain = getCurrentDomain();
  const question = catalogQuestionSchema.parse(await sendMessage('getProblem', { slug, domain }));
  return { frontendId: question.frontendId, domain };
}
