import { browser } from 'wxt/browser';
import { Config, Stats } from '@/types';

interface StoredCard {
  id: string;
  slug: string;
  name: string;
  createdAt: number;
}

export interface StorageSchema {
  config: Config;
  cards: Record<string, StoredCard>;
  stats: Stats;
  slugToCardId: Record<string, string>;
}

function getDefaultSchema(): StorageSchema {
  return {
    config: { schemaVersion: '0.1.0' },
    cards: {},
    stats: {},
    slugToCardId: {},
  };
}

export async function load(): Promise<StorageSchema> {
  const result = await browser.storage.local.get('root');
  if (!result.root) {
    return getDefaultSchema();
  }
  return result.root as StorageSchema;
}

export async function save(schema: StorageSchema): Promise<void> {
  await browser.storage.local.set({ root: schema });
}
