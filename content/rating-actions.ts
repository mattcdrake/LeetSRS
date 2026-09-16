import type { Grade } from 'ts-fsrs';
import { getCurrentDomain, getCurrentProblemSlug } from '@/content/page-context';
import { background } from '@/shared/background-service';
import { catalogProblemSchema } from '@/shared/catalog';
import type { ProblemReference } from '@/shared/models';

export async function rateCurrentProblem(rating: Grade) {
  const problem = await getCurrentProblemReference();

  await background.rateCard({ frontendId: problem.frontendId, domain: problem.domain, rating });
}

export async function addCurrentProblem() {
  const problem = await getCurrentProblemReference();

  await background.addCard({ frontendId: problem.frontendId, domain: problem.domain });
}

export async function getCurrentProblemReference(): Promise<ProblemReference> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  const domain = getCurrentDomain();
  const problem = catalogProblemSchema.parse(await background.getProblem(slug, domain));
  return { frontendId: problem.frontendId, domain };
}
