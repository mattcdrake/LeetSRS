export const STORAGE_KEYS = {
  cards: 'leetreps_cards',
  slugToCardId: 'leetreps_slug_to_card_id',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
