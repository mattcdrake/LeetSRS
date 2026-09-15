import { queryOptions } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { ProblemReference } from '@/shared/models';

export function catalogQueryOptions(cards: readonly ProblemReference[]) {
  const references = cards
    .map(({ frontendId, domain }) => ({ frontendId, domain }))
    .sort((a, b) => a.frontendId.localeCompare(b.frontendId) || a.domain.localeCompare(b.domain));
  return queryOptions({
    queryKey: ['popupCatalog', references] as const,
    staleTime: Infinity,
    queryFn: async () => {
      if (references.length === 0) return {};
      await background.waitForInitialization();
      const problems = await getProblemsByFrontendIds(references);
      return Object.fromEntries(
        references.map(({ frontendId, domain }, index): [string, CatalogProblem] => {
          const problem = problems[index];
          if (!problem) throw new Error(`Unknown problem: ${frontendId} on ${domain}`);
          return [frontendId, problem];
        })
      );
    },
  });
}
