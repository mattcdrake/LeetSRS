import { browser } from 'wxt/browser';
import { z } from 'zod';
import { type LeetcodeDomain, leetcodeDomainSchema, type ProblemReference } from '@/shared/models';

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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openCatalog(): Promise<IDBDatabase> {
  const request = indexedDB.open('leetcode-catalog', 1);
  request.onupgradeneeded = () => {
    const problems = request.result.createObjectStore('problems', { keyPath: 'frontendId' });
    problems.createIndex('slug', 'slug', { unique: true });
    request.result.createObjectStore('metadata');
  };
  return requestResult(request);
}

export async function initializeCatalog(): Promise<void> {
  const hashUrl = browser.runtime.getURL('/data/leetcode-catalog.sha256');
  const hashResponse = await fetch(hashUrl);

  if (!hashResponse.ok) {
    throw new Error(`Failed to load catalog hash: ${hashResponse.status}`);
  }

  const hashText = await hashResponse.text();
  const bundledHash = hashText.trim();
  const database = await openCatalog();

  try {
    const readTransaction = database.transaction('metadata');
    const metadataStore = readTransaction.objectStore('metadata');
    const storedHash: unknown = await requestResult(metadataStore.get('hash'));

    if (bundledHash === storedHash) {
      return;
    }

    const catalogUrl = browser.runtime.getURL('/data/leetcode-catalog.json');
    const catalogResponse = await fetch(catalogUrl);

    if (!catalogResponse.ok) {
      throw new Error(`Failed to load catalog JSON: ${catalogResponse.status}`);
    }

    const catalogData: unknown = await catalogResponse.json();
    const problems = z.array(catalogProblemSchema).parse(catalogData);

    await replaceCatalog(database, problems, bundledHash);
  } finally {
    database.close();
  }
}

function replaceCatalog(database: IDBDatabase, problems: CatalogProblem[], hash: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['problems', 'metadata'], 'readwrite');

    transaction.oncomplete = () => {
      resolve();
    };

    // Request errors abort the transaction by default, rolling back records and hash together.
    transaction.onabort = () => {
      const error = transaction.error ?? new Error('Catalog transaction aborted');
      reject(error);
    };

    try {
      const problemsStore = transaction.objectStore('problems');
      const metadataStore = transaction.objectStore('metadata');

      problemsStore.clear();

      for (const problem of problems) {
        problemsStore.add(problem);
      }

      metadataStore.put(hash, 'hash');
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

export async function getProblemByFrontendId(
  frontendId: string,
  domain: LeetcodeDomain
): Promise<CatalogProblem | undefined> {
  return getProblem(frontendId, domain, 'frontendId');
}

export async function getProblemsByFrontendIds(
  problems: readonly ProblemReference[]
): Promise<(CatalogProblem | undefined)[]> {
  if (problems.length === 0) return [];
  const database = await openCatalog();
  try {
    const store = database.transaction('problems', 'readonly').objectStore('problems');
    return await Promise.all(
      problems.map(async ({ frontendId, domain }) => {
        const value: unknown = await requestResult(store.get(frontendId));
        return parseProblemForDomain(value, domain);
      })
    );
  } finally {
    database.close();
  }
}

export async function getProblemBySlug(slug: string, domain: LeetcodeDomain): Promise<CatalogProblem | undefined> {
  return getProblem(slug, domain, 'slug');
}

async function getProblem(
  key: string,
  domain: LeetcodeDomain,
  field: 'frontendId' | 'slug'
): Promise<CatalogProblem | undefined> {
  const database = await openCatalog();
  try {
    const store = database.transaction('problems').objectStore('problems');
    const value: unknown = await requestResult((field === 'slug' ? store.index('slug') : store).get(key));
    return parseProblemForDomain(value, domain);
  } finally {
    database.close();
  }
}

function parseProblemForDomain(value: unknown, domain: LeetcodeDomain): CatalogProblem | undefined {
  if (value === undefined) return undefined;
  const problem = catalogProblemSchema.parse(value);
  return problem.sources.includes(domain) ? problem : undefined;
}
