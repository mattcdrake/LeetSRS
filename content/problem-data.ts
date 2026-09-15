import { getCurrentDomain, getCurrentProblemSlug } from '@/content/page-context';
import { catalogQuestionSchema } from '@/shared/catalog';
import { sendMessage } from '@/shared/messages';
import type { ProblemReference } from '@/shared/models';

export async function getCurrentProblem(): Promise<ProblemReference> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  const domain = getCurrentDomain();
  const question = catalogQuestionSchema.parse(await sendMessage('getProblem', { slug, domain }));
  return { frontendId: question.frontendId, domain };
}
