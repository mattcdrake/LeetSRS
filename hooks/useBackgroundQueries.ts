// Query Keys with hierarchical structure
export const queryKeys = {
  // Card related queries
  cards: {
    all: ['cards'] as const,
    reviewQueue: ['cards', 'reviewQueue'] as const,
  },
  // Notes related queries
  notes: {
    all: ['notes'] as const,
    detail: (cardId: string) => ['notes', cardId] as const,
  },
  // Stats related queries
  stats: {
    all: ['stats'] as const,
    today: ['stats', 'today'] as const,
    cardState: ['stats', 'cardState'] as const,
    lastNDays: (days: number) => ['stats', 'lastNDays', days] as const,
    nextNDays: (days: number) => ['stats', 'nextNDays', days] as const,
  },
  // Settings related queries
  settings: {
    all: ['settings'] as const,
  },
  // Gist Sync related queries
  gistSync: {
    all: ['gistSync'] as const,
    config: ['gistSync', 'config'] as const,
    status: ['gistSync', 'status'] as const,
  },
} as const;

export * from './queries/cards';
export * from './queries/data';
export * from './queries/gist-sync';
export * from './queries/notes';
export * from './queries/settings';
export * from './queries/stats';
