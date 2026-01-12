/**
 * Centralized text strings for internationalization. All user-facing text should be defined here.
 */

export const i18n = {
  // App branding
  app: {
    name: 'LeetSRS',
    namePart1: 'Leet',
    namePart2: 'SRS',
  },

  // Navigation
  nav: {
    home: 'Home',
    cards: 'Cards',
    stats: 'Stats',
    settings: 'Settings',
  },

  // Common actions
  actions: {
    save: 'Save',
    saving: 'Saving...',
    delete: 'Delete',
    deleting: 'Deleting...',
    confirm: 'Confirm?',
    confirmDelete: 'Confirm Delete?',
    pause: 'Pause',
    resume: 'Resume',
    reload: 'Reload extension',
  },

  // Common states
  states: {
    loading: 'Loading...',
    new: 'New',
    learning: 'Learning',
    review: 'Review',
    relearning: 'Relearning',
    unknown: 'Unknown',
  },

  // Difficulty levels
  difficulty: {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  },

  // Rating buttons
  ratings: {
    again: 'Again',
    hard: 'Hard',
    good: 'Good',
    easy: 'Easy',
  },

  // Error boundary
  errors: {
    somethingWentWrong: 'Something went wrong',
    unexpectedError: 'An unexpected error occurred',
    errorDetails: 'Error details',
    failedToLoadReviewQueue: 'Failed to load review queue',
    failedToExportData: 'Failed to export data',
    failedToResetData: 'Failed to reset data',
    unknownError: 'Unknown error',
  },

  // Home view - Review queue
  home: {
    loadingReviewQueue: 'Loading review queue...',
    noCardsToReview: 'No cards to review!',
    addProblemsInstructions: 'Add problems on LeetCode using the',
    addProblemsButton: "button next to 'Submit'.",
  },

  // Home view - Stats bar
  statsBar: {
    review: 'review',
    new: 'new',
    learn: 'learn',
  },

  // Home view - Actions section
  actionsSection: {
    title: 'Actions',
    delay1Day: '1 Day',
    delay5Days: '5 Days',
    deleteCard: 'Delete Card',
  },

  // Home view - Notes section
  notes: {
    title: 'Notes',
    ariaLabel: 'Note text',
    placeholderLoading: 'Loading...',
    placeholderEmpty: 'Add your notes here...',
  },

  // Cards view
  cardsView: {
    title: 'Cards',
    filterAriaLabel: 'Filter cards',
    filterPlaceholder: 'Filter by name or ID...',
    clearFilterAriaLabel: 'Clear filter',
    loadingCards: 'Loading cards...',
    noCardsAdded: 'No cards added yet.',
    noCardsMatchFilter: 'No cards match your filter.',
    cardPausedTitle: 'Card is paused',
  },

  // Card stats labels
  cardStats: {
    state: 'State',
    reviews: 'Reviews',
    stability: 'Stability',
    lapses: 'Lapses',
    difficulty: 'Difficulty',
    due: 'Due',
    last: 'Last',
    added: 'Added',
  },

  // Stats view
  statsView: {
    title: 'Statistics',
  },

  // Charts
  charts: {
    cardDistribution: 'Card Distribution',
    reviewHistory: 'Last 30 Days Review History',
    upcomingReviews: 'Upcoming Reviews (Next 14 Days)',
    cardsDue: 'Cards Due',
  },

  // Settings view
  settings: {
    title: 'Settings',

    // Appearance section
    appearance: {
      title: 'Appearance',
      darkMode: 'Dark mode',
      enableAnimations: 'Enable animations',
    },

    // Review settings section
    reviewSettings: {
      title: 'Review Settings',
      newCardsPerDay: 'New Cards Per Day',
    },

    // Data section
    data: {
      title: 'Data',
      exportData: 'Export Data',
      exporting: 'Exporting...',
      importData: 'Import Data',
      importing: 'Importing...',
      resetAllData: 'Reset All Data',
      resetting: 'Resetting...',
      clickToConfirm: 'Click again to confirm',
      importConfirmMessage:
        'Are you sure you want to import this data?\n\nThis will replace ALL your current data including cards, review history, and notes.',
      importSuccess: 'Data imported successfully!',
      importFailed: 'Failed to import data:',
      resetConfirmMessage:
        'Are you absolutely sure you want to delete all data? This action cannot be undone.\n\nAll your cards, review history, statistics, and notes will be permanently deleted.',
      resetSuccess: 'All data has been reset',
    },

    // GitHub Gist Sync section
    gistSync: {
      title: 'GitHub Gist Sync',
      gistDescription: 'LeetSRS Backup - Spaced Repetition Data',
      description: 'Sync your data across browsers using GitHub Gists',
      // PAT field
      patLabel: 'Personal Access Token',
      patPlaceholder: 'ghp_xxxxxxxxxxxx',
      patHelpText: 'Create a token with "gist" scope at',
      patHelpLink: 'GitHub Settings',
      validatePat: 'Validate',
      validating: 'Validating...',
      patValid: 'Valid',
      patInvalid: 'Invalid token',
      // Gist selection
      gistIdLabel: 'Gist ID',
      gistIdPlaceholder: 'Enter existing Gist ID or create new',
      createNewGist: 'Create New Gist',
      creating: 'Creating...',
      validateGist: 'Validate',
      gistValid: 'Valid',
      gistInvalid: 'Invalid gist',
      // Sync controls
      enableSync: 'Enable automatic sync',
      syncNow: 'Sync Now',
      syncing: 'Syncing...',
      // Status
      lastSync: 'Last sync',
      lastSyncNever: 'Never',
      lastSyncPushed: 'Pushed',
      lastSyncPulled: 'Pulled',
      // Errors
      patRequired: 'PAT is required to enable sync',
      gistRequired: 'Gist ID is required to enable sync',
      syncFailed: 'Sync failed',
      createGistFailed: 'Failed to create gist',
    },

    // About section
    about: {
      title: 'About',
      feedbackMessage: 'Feel free to open issues for feature requests, bug reports, and feedback on GitHub!',
      reviewRequest: 'If LeetSRS helped you, leave a review? 🙏',
      copyright: '© 2025 Matt Drake',
      github: 'GitHub',
    },
  },

  // Content script (LeetCode page integration)
  contentScript: {
    addToSrsNoRating: 'Add to SRS (no rating)',
  },

  // Formatting helpers (for interpolated strings)
  format: {
    leetcodeId: (id: string) => `#${id}`,
    stabilityDays: (days: string) => `${days}d`,
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
} as const;
