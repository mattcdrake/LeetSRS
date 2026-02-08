import type { Translations } from './index';

// Polish translations
const pl: Translations = {
  // App branding
  app: {
    name: 'LeetSRS',
    namePart1: 'Leet',
    namePart2: 'SRS',
  },

  // Navigation
  nav: {
    home: 'Strona główna',
    cards: 'Karty',
    stats: 'Statystyki',
    settings: 'Ustawienia',
  },

  // Common actions
  actions: {
    save: 'Zapisz',
    saving: 'Zapisywanie...',
    delete: 'Usuń',
    deleting: 'Usuwanie...',
    confirm: 'Potwierdzić?',
    confirmDelete: 'Potwierdzić usunięcie?',
    pause: 'Wstrzymaj',
    resume: 'Wznów',
    reload: 'Przeładuj rozszerzenie',
  },

  // Common states
  states: {
    loading: 'Ładowanie...',
    new: 'Nowa',
    learning: 'Nauka',
    review: 'Powtórka',
    relearning: 'Powtórna nauka',
    unknown: 'Nieznany',
  },

  // Difficulty levels
  difficulty: {
    easy: 'Łatwy',
    medium: 'Średni',
    hard: 'Trudny',
  },

  // Rating buttons
  ratings: {
    again: 'Ponownie',
    hard: 'Trudne',
    good: 'Dobre',
    easy: 'Łatwe',
  },

  // Error boundary
  errors: {
    somethingWentWrong: 'Coś poszło nie tak',
    unexpectedError: 'Wystąpił nieoczekiwany błąd',
    errorDetails: 'Szczegóły błędu',
    failedToLoadReviewQueue: 'Nie udało się załadować kolejki powtórek',
    failedToExportData: 'Nie udało się wyeksportować danych',
    failedToResetData: 'Nie udało się zresetować danych',
    unknownError: 'Nieznany błąd',
  },

  // Home view - Review queue
  home: {
    loadingReviewQueue: 'Ładowanie kolejki powtórek...',
    noCardsToReview: 'Brak kart do powtórki!',
    addProblemsInstructions: 'Dodawaj zadania na LeetCode za pomocą',
    addProblemsButton: "przycisku obok 'Submit'.",
  },

  // Home view - Stats bar
  statsBar: {
    review: 'powtórka',
    new: 'nowe',
    learn: 'nauka',
  },

  // Home view - Actions section
  actionsSection: {
    title: 'Akcje',
    delay1Day: '1 dzień',
    delay5Days: '5 dni',
    deleteCard: 'Usuń kartę',
  },

  // Home view - Notes section
  notes: {
    title: 'Notatki',
    ariaLabel: 'Tekst notatki',
    placeholderLoading: 'Ładowanie...',
    placeholderEmpty: 'Dodaj swoje notatki tutaj...',
  },

  // Cards view
  cardsView: {
    title: 'Karty',
    filterAriaLabel: 'Filtruj karty',
    filterPlaceholder: 'Filtruj po nazwie lub ID...',
    clearFilterAriaLabel: 'Wyczyść filtr',
    loadingCards: 'Ładowanie kart...',
    noCardsAdded: 'Nie dodano jeszcze żadnych kart.',
    noCardsMatchFilter: 'Żadne karty nie pasują do filtra.',
    cardPausedTitle: 'Karta jest wstrzymana',
  },

  // Card stats labels
  cardStats: {
    state: 'Stan',
    reviews: 'Powtórki',
    stability: 'Stabilność',
    lapses: 'Lapsy',
    difficulty: 'Trudność',
    due: 'Termin',
    last: 'Ostatnia',
    added: 'Dodano',
  },

  // Stats view
  statsView: {
    title: 'Statystyki',
  },

  // Charts
  charts: {
    cardDistribution: 'Rozkład kart',
    reviewHistory: 'Historia powtórek z ostatnich 30 dni',
    upcomingReviews: 'Nadchodzące powtórki (następne 14 dni)',
    cardsDue: 'Karty do powtórki',
  },

  // Settings view
  settings: {
    title: 'Ustawienia',

    // Language section
    language: {
      title: 'Język',
      label: 'Język wyświetlania',
    },

    // Appearance section
    appearance: {
      title: 'Wygląd',
      darkMode: 'Tryb ciemny',
      enableAnimations: 'Włącz animacje',
      showBadge: 'Pokaż liczbę powtórek na ikonie',
    },

    // Review settings section
    reviewSettings: {
      title: 'Ustawienia powtórek',
      newCardsPerDay: 'Nowe karty dziennie',
      dayStartHour: 'Przesunięcie nowego dnia (godziny po północy)',
    },

    problemAutoClear: {
      title: 'Automatyczny reset zadania',
      description: 'Automatycznie resetuj kod przy otwieraniu zadania na LeetCode.',
      enableAutoReset: 'Włącz automatyczny reset',
    },

    // Data section
    data: {
      title: 'Dane',
      exportData: 'Eksportuj dane',
      exporting: 'Eksportowanie...',
      importData: 'Importuj dane',
      importing: 'Importowanie...',
      resetAllData: 'Resetuj wszystkie dane',
      resetting: 'Resetowanie...',
      clickToConfirm: 'Kliknij ponownie, aby potwierdzić',
      importConfirmMessage:
        'Czy na pewno chcesz zaimportować te dane?\n\nTo zastąpi WSZYSTKIE Twoje obecne dane, w tym karty, historię powtórek i notatki.',
      importSuccess: 'Dane zaimportowane pomyślnie!',
      importFailed: 'Nie udało się zaimportować danych:',
      resetConfirmMessage:
        'Czy na pewno chcesz usunąć wszystkie dane? Tej operacji nie można cofnąć.\n\nWszystkie Twoje karty, historia powtórek, statystyki i notatki zostaną trwale usunięte.',
      resetSuccess: 'Wszystkie dane zostały zresetowane',
    },

    // GitHub Gist Sync section
    gistSync: {
      title: 'Synchronizacja przez GitHub Gist',
      gistDescription: 'Kopia zapasowa LeetSRS - Dane powtórek rozłożonych w czasie',
      description: 'Synchronizuj dane między przeglądarkami za pomocą GitHub Gists',
      // PAT field
      patLabel: 'Osobisty token dostępu',
      patPlaceholder: 'ghp_xxxxxxxxxxxx',
      patHelpText: 'Utwórz token z uprawnieniem "gist" na',
      patHelpLink: 'Ustawienia GitHub',
      validatePat: 'Zweryfikuj',
      validating: 'Weryfikowanie...',
      patValid: 'Prawidłowy',
      patInvalid: 'Nieprawidłowy token',
      // Gist selection
      gistIdLabel: 'ID Gista',
      gistIdPlaceholder: 'Wpisz istniejące ID Gista lub utwórz nowy',
      createNewGist: 'Utwórz nowy Gist',
      creating: 'Tworzenie...',
      validateGist: 'Zweryfikuj',
      gistValid: 'Prawidłowy',
      gistInvalid: 'Nieprawidłowy gist',
      // Sync controls
      enableSync: 'Włącz automatyczną synchronizację',
      syncNow: 'Synchronizuj teraz',
      syncing: 'Synchronizowanie...',
      // Status
      lastSync: 'Ostatnia synchronizacja',
      lastSyncNever: 'Nigdy',
      lastSyncPushed: 'Wysłano',
      lastSyncPulled: 'Pobrano',
      // Errors
      patRequired: 'Token jest wymagany do włączenia synchronizacji',
      gistRequired: 'ID Gista jest wymagane do włączenia synchronizacji',
      syncFailed: 'Synchronizacja nie powiodła się',
      createGistFailed: 'Nie udało się utworzyć gista',
    },

    // About section
    about: {
      title: 'O aplikacji',
      feedbackMessage: 'Zgłaszaj propozycje funkcji, błędy i uwagi na GitHubie!',
      reviewRequest: 'Jeśli LeetSRS Ci pomógł, zostaw recenzję?',
      copyright: '© 2026 Matt Drake',
      github: 'GitHub',
    },
  },

  // Content script (LeetCode page integration)
  contentScript: {
    addToSrsNoRating: 'Dodaj do SRS (bez oceny)',
  },

  // Formatting helpers (for interpolated strings)
  format: {
    leetcodeId: (id: string) => `#${id}`,
    stabilityDays: (days: string) => `${days}d`,
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
} as const;

export default pl;
