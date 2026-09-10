import type { Migration, MigrationData } from './types';

function addCardDomain(data: MigrationData): MigrationData {
  if (!data.cards) return data;
  const cards = Object.fromEntries(
    Object.entries(data.cards).map(([slug, card]) => {
      // Leave malformed records for record validation after migration.
      if (typeof card !== 'object' || card === null || Array.isArray(card)) return [slug, card];
      if ('domain' in card && card.domain) return [slug, card];
      return [slug, { ...card, domain: 'leetcode.com' }];
    })
  );
  return { ...data, cards };
}

export const addCardDomainMigration: Migration = {
  description: 'Add domain field to existing cards, defaulting to leetcode.com',
  migrate: addCardDomain,
};
