import { browser } from 'wxt/browser';
import { z } from 'zod';
import { type LeetcodeDomain, leetcodeDomainSchema } from '@/shared/models';

const catalogQuestionSchema = z.looseObject({
  frontendId: z.string().min(1),
  title: z.string(),
  translatedTitle: z.string().nullable(),
  slug: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  isPaidOnly: z.boolean(),
  topics: z.array(z.string()),
  sources: z.array(leetcodeDomainSchema),
});

export type CatalogQuestion = z.infer<typeof catalogQuestionSchema>;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openCatalog(): Promise<IDBDatabase> {
  const request = indexedDB.open('leetsrs-catalog', 1);
  request.onupgradeneeded = () => {
    const questions = request.result.createObjectStore('questions', { keyPath: 'frontendId' });
    questions.createIndex('slug', 'slug', { unique: true });
    request.result.createObjectStore('metadata');
  };
  return requestResult(request);
}

export async function initializeCatalog(): Promise<void> {
  const hashResponse = await fetch(browser.runtime.getURL('/data/leetcode-catalog.sha256'));
  if (!hashResponse.ok) throw new Error(`Failed to load catalog hash: ${hashResponse.status}`);
  const hash = (await hashResponse.text()).trim();
  const database = await openCatalog();
  try {
    const storedHash: unknown = await requestResult(
      database.transaction('metadata').objectStore('metadata').get('hash')
    );
    if (hash === storedHash) return;

    const response = await fetch(browser.runtime.getURL('/data/leetcode-catalog.json'));
    if (!response.ok) throw new Error(`Failed to load catalog JSON: ${response.status}`);
    const questions = z.array(catalogQuestionSchema).parse(await response.json());
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['questions', 'metadata'], 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Catalog transaction aborted'));
      try {
        const store = transaction.objectStore('questions');
        store.clear();
        for (const question of questions) store.add(question);
        transaction.objectStore('metadata').put(hash, 'hash');
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export async function getQuestionByFrontendId(
  frontendId: string,
  domain: LeetcodeDomain
): Promise<CatalogQuestion | undefined> {
  return getQuestion(frontendId, domain, 'frontendId');
}

export async function getQuestionBySlug(slug: string, domain: LeetcodeDomain): Promise<CatalogQuestion | undefined> {
  return getQuestion(slug, domain, 'slug');
}

async function getQuestion(
  key: string,
  domain: LeetcodeDomain,
  field: 'frontendId' | 'slug'
): Promise<CatalogQuestion | undefined> {
  const database = await openCatalog();
  try {
    const store = database.transaction('questions').objectStore('questions');
    const value: unknown = await requestResult((field === 'slug' ? store.index('slug') : store).get(key));
    if (value === undefined) return undefined;
    const question = catalogQuestionSchema.parse(value);
    return question.sources.includes(domain) ? question : undefined;
  } finally {
    database.close();
  }
}
