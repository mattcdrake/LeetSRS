import { browser } from 'wxt/browser';
import { z } from 'zod';
import { leetcodeDomainSchema } from '@/shared/leetcode-domain';
import type { LeetcodeDomain, ProblemReference } from '@/shared/models';

export const catalogProblemSchema = z.looseObject({
  frontendId: z.string().min(1),
  title: z.string(),
  translatedTitle: z.string().nullable(),
  slug: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  isPaidOnly: z.boolean(),
  topics: z.array(z.string()),
  sources: z.array(leetcodeDomainSchema),
});

export type CatalogProblem = z.infer<typeof catalogProblemSchema>;

let byId: Promise<Record<string, CatalogProblem>> | undefined;
let bySlug: Promise<Record<string, CatalogProblem>> | undefined;

async function loadCatalog(
  file: 'leetcode-catalog-by-id.json' | 'leetcode-catalog-by-slug.json'
): Promise<Record<string, CatalogProblem>> {
  const response = await fetch(browser.runtime.getURL(`/data/${file}`));
  if (!response.ok) throw new Error(`Failed to load catalog JSON: ${response.status}`);
  return z.record(z.string(), catalogProblemSchema).parse(await response.json());
}

export async function getProblemsByFrontendIds(
  problems: readonly ProblemReference[]
): Promise<(CatalogProblem | undefined)[]> {
  const metadata = await getCatalogProblemsByFrontendIds(problems.map((problem) => problem.frontendId));
  return metadata.map((problem, index) => (problem?.sources.includes(problems[index].domain) ? problem : undefined));
}

// Roadmaps also display metadata for problems unavailable on the preferred site.
export async function getCatalogProblemsByFrontendIds(
  frontendIds: readonly string[]
): Promise<(CatalogProblem | undefined)[]> {
  if (frontendIds.length === 0) return [];
  byId ??= loadCatalog('leetcode-catalog-by-id.json');
  const catalog = await byId;
  return frontendIds.map((id) => (Object.hasOwn(catalog, id) ? catalog[id] : undefined));
}

export async function getProblemBySlug(slug: string, domain: LeetcodeDomain): Promise<CatalogProblem | undefined> {
  bySlug ??= loadCatalog('leetcode-catalog-by-slug.json');
  const catalog = await bySlug;
  return problemForDomain(catalog, slug, domain);
}

function problemForDomain(
  catalog: Record<string, CatalogProblem>,
  key: string,
  domain: LeetcodeDomain
): CatalogProblem | undefined {
  const problem = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  return problem?.sources.includes(domain) ? problem : undefined;
}
