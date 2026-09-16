import { getCurrentDomain, getCurrentProblemSlug } from '@/content/page-context';
import { background } from '@/shared/background-service';
import { catalogProblemSchema } from '@/shared/catalog';
import type { ProblemReference } from '@/shared/models';

export async function getCurrentProblemReference(): Promise<ProblemReference> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  const domain = getCurrentDomain();
  const problem = catalogProblemSchema.parse(await background.getProblem(slug, domain));
  return { frontendId: problem.frontendId, domain };
}
