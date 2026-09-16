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
    missingGist: 'Gist ID is not configured. Choose a Gist in Settings.',
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
    cards: 'Cards',
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
      newCardsPerDay: 'New Cards Per Day',
    },

    editorReset: {
      resetEditorOnReviewQueue: 'Reset code on review',
    },

    leetcodeCn: {
      title: 'LeetCode China',
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
      permissionExplanation:
        'GitHub sign-in and backup sync need access to auth.leetsrs.com, api.github.com, and gist.githubusercontent.com. Local practice works without this access.',
      permissionRequired: 'GitHub access was removed. Re-enable it to resume backup sync.',
      enableAccess: 'Enable GitHub access',
      permissionFailed:
        'GitHub access wasn’t granted. Try again using the button above; local practice is still available.',
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
      edit: 'Edit',
      cancel: 'Cancel',
      latestEditNotice:
        'Newest edit wins across the whole dataset. Simultaneous changes in another browser may be lost.',
      howSyncWorks: 'How sync works',
      syncDetails:
        'LeetSRS compares the edit time of each complete dataset and replaces the older one. It does not merge individual cards.',
      openGist: 'Open backup Gist',
      open: 'Open',
      change: 'Change',
      destination: 'Backup Gist',
      syncInfo: 'How sync works',
      existingGist: 'Use existing Gist',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Connection saved',
      saveFailed: 'Connection could not be saved',
      configFailed: 'Could not load the saved connection',
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
    saveFailed: 'Could not save this problem. Please try again.',
    addToSrsNoRating: 'Add to SRS (no rating)',
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
