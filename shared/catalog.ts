import { browser } from 'wxt/browser';
import { z } from 'zod';
import type { ProblemReference } from '@/shared/learning-document';
import { type LeetcodeDomain, leetcodeDomainSchema } from '@/shared/leetcode-domain';

export const catalogProblemSchema = z.looseObject({
  frontendId: z.string().min(1),
  title: z.string(),
  translatedTitle: z.string().nullable(),
  slug: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  isPaidOnly: z.boolean(),
  topics: z.array(z.string()),
  sources: z.array(leetcodeDomainSchema),
  youtubeUrl: z
    .string()
    .regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/)
    .optional(),
});

export type CatalogProblem = z.infer<typeof catalogProblemSchema>;

let byId: Promise<Record<string, CatalogProblem>> | undefined;
let bySlug: Promise<Record<string, CatalogProblem>> | undefined;

async function loadCatalog(): Promise<Record<string, CatalogProblem>> {
  const response = await fetch(browser.runtime.getURL('/data/leetcode-catalog-by-id.json'));
  if (!response.ok) throw new Error(`Failed to load catalog JSON: ${response.status}`);
  return z.record(z.string(), catalogProblemSchema).parse(await response.json());
}

export async function getProblemsByFrontendIds(
  problems: readonly ProblemReference[]
): Promise<(CatalogProblem | undefined)[]> {
  if (problems.length === 0) return [];
  byId ??= loadCatalog();
  const catalog = await byId;
  return problems.map(({ frontendId, domain }) => problemForDomain(catalog, frontendId, domain));
}

export async function getProblemBySlug(slug: string, domain: LeetcodeDomain): Promise<CatalogProblem | undefined> {
  byId ??= loadCatalog();
  bySlug ??= byId.then((catalog) =>
    Object.fromEntries(Object.values(catalog).map((problem) => [problem.slug, problem]))
  );
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
