import { Rating } from 'ts-fsrs';
import { patMigration } from './legacy/en';
import { getTopicLabel } from './topic-labels';

// English translations (base language - all other translations must match this structure)
const en = {
  topicLabel: (topic: string) => getTopicLabel(topic, 'en'),
  // App branding
  syncNotices: {
    missingBackup: 'The Gist contains no LeetSRS backup. Choose another Gist in Settings.',
    creationFailed: 'GitHub returned no ID for the created Gist. Check your Gists before trying again.',
    connectionSaveFailed: 'The connection could not be saved.',
    unavailable: 'You can continue learning. Sync will resume automatically when GitHub is available.',
    rateLimit: 'GitHub API rate limit exceeded. Please try again later. You can continue learning.',
    authentication: 'Sign in with GitHub again in Settings.',
    missingToken: 'Sign in with GitHub in Settings.',
    gistNotFound: 'Backup not found. Choose an available backup in Settings.',
    unknown: 'Sync failed. Try again later.',
  },
  app: {
    name: 'LeetSRS',
    namePart1: 'Leet',
    namePart2: 'SRS',
  },

  // Navigation
  nav: {
    home: 'Home',
    roadmaps: 'Roadmaps',
    cards: 'Cards',
    settings: 'Settings',
  },

  roadmaps: {
    activate: 'Activate',
    deactivate: 'Deactivate',
    searchLabel: 'Search roadmap problems',
    filters: { notInSrs: 'Not in SRS', inSrs: 'In SRS', reviewed: 'Reviewed', skipped: 'Skipped' },
    noMatches: 'No matching problems.',
    detailLoadFailed: 'Could not load roadmap problems. Try again.',
    skipFailed: 'Could not save skipped problems. Try again.',
    skip: 'Skip',
    restore: 'Restore',
    skipProblem: (title: string) => `Skip ${title}`,
    restoreProblem: (title: string) => `Restore ${title}`,
    paidOnly: 'Paid-only problem',
    problem: (id: string) => `Problem ${id}`,
    unavailable: (domain: string) => `Unavailable on ${domain}`,
    open: (name: string) => `Open ${name}`,
    activationLabel: (name: string) => `Use ${name} as active roadmap`,
    reviewed: (count: number, total: number) => `${count} of ${total} reviewed`,
    back: 'Back to all roadmaps',
    loading: 'Loading roadmaps...',
    loadFailed: 'Failed to load roadmaps.',
    saveFailed: 'Could not save the active roadmap. Try again.',
    retry: 'Retry',
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
    new: 'New',
    learning: 'Learning',
    review: 'Review',
    relearning: 'Relearning',
    unknown: 'Unknown',
  },

  // Rating buttons
  ratings: {
    [Rating.Again]: 'Again',
    [Rating.Hard]: 'Hard',
    [Rating.Good]: 'Good',
    [Rating.Easy]: 'Easy',
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
    currentRoadmap: 'Current roadmap',
    nextProblem: 'Next in your roadmap',
    viewRoadmap: 'View roadmap',
    roadmapReviewed: (count: number, total: number) => `${count} / ${total} reviewed`,
    activateRoadmapSuggestion: 'Activate a roadmap to find your next problem.',
    browseRoadmaps: 'Browse roadmaps',
    noNextProblem: (domain: string) => `No unadded, unskipped problems available on ${domain}.`,
    loadingReviewQueue: 'Loading review queue...',
    noCardsToReview: 'No cards to review!',
    addProblemsInstructions: 'Add problems on LeetCode using the',
    addProblemsButton: "button next to 'Submit'.",
    leetcodeCnBanner: {
      message: 'Using leetcode.cn? Enable support to add problems.',
      enable: 'Enable',
      dismiss: 'Dismiss',
    },
  },

  // Home view - Stats bar
  statsBar: {
    review: 'review',
    new: 'new',
  },

  // Home view - Actions section
  actionsSection: {
    postpone: 'Postpone review',
    pauseCard: 'Pause card',
    title: 'Actions',
    delay1Day: '1 Day',
    delay5Days: '5 Days',
    deleteCard: 'Delete Card',
  },

  // Home view - Notes section
  notes: {
    saveFailed: 'Could not save your note. Your draft is kept. Try saving again.',
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
    filters: { due: 'Due', new: 'New', paused: 'Paused' },
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

  // Settings view
  settings: {
    preferences: 'Preferences',
    title: 'Settings',

    // Language section
    language: {
      label: 'Display language',
    },

    // Appearance section
    appearance: {
      theme: 'Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
    },

    // Review settings section
    reviewSettings: {
      openRatingAfterSolving: 'Open rating panel after solving',
      newCardsPerDay: 'New Cards Per Day',
    },

    editorReset: {
      resetEditorOnReviewQueue: 'Reset code on review',
    },
    preferredLeetcodeSite: 'Preferred LeetCode site',
    leetcodeCn: {
      description: 'Enable support for leetcode.cn (力扣). Requires additional browser permission.',
      enable: 'Enable',
    },

    // Data section
    data: {
      title: 'Data & backups',
      description: 'Save a backup or restore one you’ve saved.',
      exportData: 'Export backup',
      exporting: 'Exporting...',
      importData: 'Import backup',
      importing: 'Importing...',
      resetAllData: 'Reset all data',
      resetAction: 'Reset…',
      resetDescription: 'Permanently erase your saved data.',
      resetting: 'Resetting...',
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
      permissionRequired: 'GitHub access was removed. Re-enable it to resume backup sync.',
      enableAccess: 'Enable GitHub access',
      permissionFailed:
        'GitHub access wasn’t granted. Retry sign-in or enable GitHub access; local practice is still available.',
      signIn: 'Sign in with GitHub',
      signingIn: 'Signing in…',
      signOut: 'Sign out',
      signInFailed: 'Couldn’t sign in. Please try again.',
      ...patMigration,
      chooseBackup: 'Choose a backup',
      previousBackup: 'Previous backup',
      loadingBackups: 'Loading backups…',
      loadBackupsFailed: 'Could not load backups.',
      retry: 'Retry',
      connectAndSync: 'Connect and sync',

      title: 'GitHub Gist Sync',
      gistDescription: 'LeetSRS Backup - Spaced Repetition Data',
      // Gist selection
      createNewGist: 'Create New Gist',
      // Sync controls
      syncEnabled: 'Sync automatically',
      syncing: 'Syncing...',
      // Status
      lastSync: 'Last sync',
      lastSyncNever: 'Never',
      // Errors
      syncFailed: 'Sync failed',
      cancel: 'Cancel',
      syncDetails:
        'LeetSRS compares the edit time of each complete dataset and replaces the older one. It does not merge individual cards.',
      openGist: 'Open backup Gist',
      open: 'Open',
      change: 'Change',
      destination: 'Backup Gist',
      syncInfo: 'How sync works',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Connection saved',
      saveFailed: 'Connection could not be saved',
    },

    // About section
    about: {
      title: 'About',
      feedbackLink: 'Report a bug or suggest a feature',
      reviewRequest: 'Rate LeetSRS',
      copyright: '© 2026 Matt Drake',
      github: 'Star on GitHub',
      discord: 'Join Discord',
    },
  },

  // Content script (LeetCode page integration)
  contentScript: {
    howDidItGo: 'How did it go?',
    descriptions: {
      1: 'Needed the solution',
      2: 'Solved with effort',
      3: 'Recalled the approach',
      4: 'Felt effortless',
    },
    saveWithoutRating: 'Save without rating',
    autoOpenHint: 'Opens after you solve a problem.',
    turnOffAutoOpen: 'Turn off auto-open',
    saved: 'Saved',
    retry: 'Try again',
    days: (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`,
    reviewIn: (days: number) => `Review in ${days} ${days === 1 ? 'day' : 'days'}`,

    saveFailed: 'Could not save this problem. Please try again.',
  },

  // Formatting helpers (for interpolated strings)
  format: {
    leetcodeId: (id: string) => `#${id}`,
    stabilityDays: (days: string) => `${days}d`,
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
};

export default en;
