import { Rating } from 'ts-fsrs';
import { patMigration } from './legacy/en';
import { getTopicLabel } from './topic-labels';

// English translations (base language - all other translations must match this structure)
const en = {
  youtubeSolution: 'Watch NeetCode solution on YouTube',
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

  releaseAnnouncement: {
    title: 'LeetSRS 1.0',
    eyebrow: 'What’s new',
    roadmapsTitle: 'A plan for your next problem',
    roadmapsDescription:
      'Follow Blind 75, NeetCode 150/250, or Grind 75. Find your next problem and keep it fresh with spaced repetition.',
    calendarTitle: 'See your reviews ahead',
    calendarDescription: 'Your new calendar puts upcoming reviews in one place.',
    syncTitle: 'Easier GitHub sync',
    syncDescription: 'Sign in with GitHub to sync across devices. No token setup.',
    upgradeTitle: 'Upgrading to 1.0?',
    upgradeSync: 'Already syncing? Sign in again in Settings and choose your existing backup to reconnect.',
    tryRoadmaps: 'Try Roadmaps',
    dismiss: 'Dismiss release notes',
  },

  // Navigation
  nav: {
    home: 'Home',
    calendar: 'Calendar',
    roadmaps: 'Roadmaps',
    cards: 'Cards',
    settings: 'Settings',
  },

  calendar: {
    previousPage: 'Previous 4 weeks',
    nextPage: 'Next 4 weeks',
    today: 'Today',
    tomorrow: 'Tomorrow',
    due: (count: number) => `${count} due`,
    dueUnit: 'due',
    overdue: (count: number) => `${count} overdue`,
    new: (count: number) => `${count} new`,
    overdueBy: (interval: string) => `Overdue ${interval}`,
    monthStart: (date: Date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date),
    empty: 'No problems due on this day.',
    nothingScheduled: 'Nothing scheduled yet',
    nothingScheduledDescription: 'Save a problem from Home or Roadmaps and its reviews appear here.',
    loading: 'Loading problems...',
    loadFailed: 'Could not load problems.',
    retry: 'Retry',
  },

  difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },

  roadmaps: {
    active: 'Active',
    stopUsing: 'Stop using',
    use: 'Use',
    otherRoadmaps: 'Other roadmaps',
    next: 'Next',
    searchLabel: 'Search roadmap problems',
    searchPlaceholder: 'Search by name or ID',
    clearSearch: 'Clear search',
    filterLabel: (filter: string) => `Filter: ${filter}`,
    clearFilter: 'Clear filter',
    all: 'All',
    filters: { notInSrs: 'Not in SRS', inSrs: 'In SRS', reviewed: 'Reviewed', skipped: 'Skipped' },
    noMatches: 'No matching problems',
    noMatchesHint: 'Try a different search or filter.',
    clearFilters: 'Clear filters',
    summaryPrefix: '',
    summarySuffix: (total: number) => `/ ${total} reviewed`,
    legend: {
      reviewed: (count: number) => `${count} reviewed`,
      new: (count: number) => `${count} new`,
      skipped: (count: number) => `${count} skipped`,
    },
    new: 'New',
    dueToday: 'Due today',
    dueIn: (interval: string) => `Due in ${interval}`,
    more: 'More actions',
    moreActions: (title: string) => `More actions for ${title}`,
    watchSolution: 'Watch solution',
    rateAgain: 'Rate again…',
    saveWithRating: 'Save with rating…',
    addToSrs: 'Add to SRS',
    addProblem: (title: string) => `Add ${title} to SRS`,
    added: (title: string) => `${title} · Added to SRS`,
    undo: 'Undo',
    undoProblem: (title: string) => `Undo adding ${title}`,
    addFailed: 'Could not update SRS. Try again.',
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
    activationLabel: (name: string) => `Use ${name}`,
    reviewed: (count: number, total: number) => `${count} of ${total} reviewed`,
    back: 'Back to all roadmaps',
    loading: 'Loading roadmaps...',
    loadFailed: 'Failed to load roadmaps.',
    saveFailed: 'Could not save the active roadmap. Try again.',
    retry: 'Retry',
  },

  problemSave: {
    saveProblem: (title: string) => `Save ${title}`,
    close: 'Close save menu',
    previewFailed: 'Could not load review intervals.',
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
    roadmapReviewed: (count: number, total: number) => `${count} / ${total} reviewed`,
    noNextProblem: (domain: string) => `No unadded, unskipped problems available on ${domain}.`,
    loadingReviewQueue: 'Loading review queue...',
    upNext: 'Up next',
    queuePosition: (position: number, total: number) => `${position} of ${total}`,
    caughtUp: 'All caught up',
    caughtUpDescription: 'New reviews appear here when they’re due.',
    freshTitle: 'Start your first review',
    freshDescription: 'Pick a roadmap and LeetSRS will hand you one problem at a time, then schedule reviews for you.',
    chooseRoadmap: 'Choose a roadmap',
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
    postponeShort: 'Postpone',
    pauseCard: 'Pause card',
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
    groups: { reviews: 'Reviews', display: 'Display', leetcode: 'LeetCode' },
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
      resetEditorOnReviewQueue: 'Reset code when due',
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
      feedbackLink: 'Open an issue',
      reviewRequest: 'Rate LeetSRS',
      copyright: '© 2026 Matt Drake',
      github: 'Star on GitHub',
      discord: 'Join Discord',
    },
  },

  // Content script (LeetCode page integration)
  contentScript: {
    nextReview: 'Next review',
    nextInRoadmap: (name: string) => `Next in ${name}`,
    noOtherReviews: 'No other reviews due',
    noNextRoadmapProblem: (name: string) => `No new problems in ${name}`,
    loadingNextReview: 'Loading next review…',
    loadingNextRoadmap: 'Loading next roadmap problem…',
    nextReviewFailed: 'Could not load the next review.',
    nextRoadmapFailed: 'Could not load the next roadmap problem.',
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
    intervalShort: (days: number) => {
      if (days < 100) return `${days}d`;
      if (days < 365) return `${Math.round(days / 30)}mo`;
      const years = days / 365;
      return `${years < 10 ? Number(years.toFixed(1)) : Math.round(years)}y`;
    },
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
};

export default en;
