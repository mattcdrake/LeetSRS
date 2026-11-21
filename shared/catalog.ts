import { browser } from 'wxt/browser';
import { z } from 'zod';
import { storage } from '#imports';
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
type Catalog = Record<string, CatalogProblem>;

const catalogSchema = z.record(z.string(), catalogProblemSchema);

// Every installed version downloads these files from main. Keep changes readable by
// catalogProblemSchema, or publish a breaking format under a new version.
const CATALOG_FILE = 'data/leetcode-catalog-v1';
const REMOTE_CATALOG_BASE = `https://raw.githubusercontent.com/mattcdrake/LeetSRS/main/public/${CATALOG_FILE}`;

// Once downloaded, this copy replaces the bundled catalog for good.
const downloadedCatalogItem = storage.defineItem<{ sha256: string; problems: Catalog }>(
  'local:leetsrs:downloadedCatalogV1'
);

let byId: Promise<Catalog> | undefined;
let bySlug: Promise<Catalog> | undefined;

async function loadCatalog(): Promise<Catalog> {
  const downloaded = await downloadedCatalogItem.getValue();
  if (downloaded) return downloaded.problems;
  const response = await fetch(browser.runtime.getURL(`/${CATALOG_FILE}.json`));
  if (!response.ok) throw new Error(`Failed to load catalog JSON: ${response.status}`);
  return catalogSchema.parse(await response.json());
}

/** Downloads the published catalog when its checksum differs from the saved copy. */
export async function refreshCatalog(): Promise<void> {
  const published = (await fetchRemote('sha256')).trim();
  if (published === (await downloadedCatalogItem.getValue())?.sha256) return;

  const text = await fetchRemote('json');
  const problems = catalogSchema.parse(JSON.parse(text));
  // Save the checksum of what arrived, so a stale download is retried next time.
  await downloadedCatalogItem.setValue({ sha256: await sha256(text), problems });
  byId = bySlug = undefined;
}

async function fetchRemote(extension: 'json' | 'sha256'): Promise<string> {
  const response = await fetch(`${REMOTE_CATALOG_BASE}.${extension}`);
  if (!response.ok) throw new Error(`Failed to download catalog ${extension}: ${response.status}`);
  return response.text();
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
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

function problemForDomain(catalog: Catalog, key: string, domain: LeetcodeDomain): CatalogProblem | undefined {
  const problem = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  return problem?.sources.includes(domain) ? problem : undefined;
}
