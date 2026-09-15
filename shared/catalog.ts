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
  const request = indexedDB.open('leetcode-catalog', 1);
  request.onupgradeneeded = () => {
    const questions = request.result.createObjectStore('questions', { keyPath: 'frontendId' });
    questions.createIndex('slug', 'slug', { unique: true });
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
    const questions = z.array(catalogQuestionSchema).parse(catalogData);

    await replaceCatalog(database, questions, bundledHash);
  } finally {
    database.close();
  }
}

function replaceCatalog(database: IDBDatabase, questions: CatalogQuestion[], hash: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['questions', 'metadata'], 'readwrite');

    transaction.oncomplete = () => {
      resolve();
    };

    // Request errors abort the transaction by default, rolling back records and hash together.
    transaction.onabort = () => {
      const error = transaction.error ?? new Error('Catalog transaction aborted');
      reject(error);
    };

    try {
      const questionsStore = transaction.objectStore('questions');
      const metadataStore = transaction.objectStore('metadata');

      questionsStore.clear();

      for (const question of questions) {
        questionsStore.add(question);
      }

      metadataStore.put(hash, 'hash');
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
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
