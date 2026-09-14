import { Rating } from 'ts-fsrs';
import type { Translations } from './index';

// Polish translations
const pl: Translations = {
  // App branding
  syncNotices: {
    missingBackup: 'Gist nie zawiera kopii zapasowej LeetSRS. Wybierz inny Gist w ustawieniach.',
    creationFailed: 'GitHub nie zwrócił identyfikatora utworzonego Gist. Sprawdź swoje Gisty przed ponowną próbą.',
    connectionSaveFailed: 'Nie udało się zapisać połączenia.',
    unavailable: 'Możesz kontynuować naukę. Synchronizacja wznowi się automatycznie, gdy GitHub będzie dostępny.',
    rateLimit: 'Osiągnięto limit API GitHub. Spróbuj później. Możesz kontynuować naukę.',
    authentication: 'Sprawdź token GitHub i jego uprawnienia do Gist w ustawieniach.',
    missingToken: 'Brak tokenu. Dodaj token GitHub w ustawieniach.',
    missingGist: 'Brak identyfikatora Gist. Wybierz Gist w ustawieniach.',
    gistNotFound: 'Nie znaleziono Gist. Sprawdź identyfikator i dostęp tokenu w ustawieniach.',
    unknown: 'Synchronizacja nie powiodła się. Spróbuj ponownie później.',
  },
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
    new: 'Nowa',
    learning: 'Nauka',
    review: 'Powtórka',
    relearning: 'Powtórna nauka',
    unknown: 'Nieznany',
  },

  // Rating buttons
  ratings: {
    [Rating.Again]: 'Ponownie',
    [Rating.Hard]: 'Trudne',
    [Rating.Good]: 'Dobre',
    [Rating.Easy]: 'Łatwe',
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
    leetcodeCnBanner: {
      message: 'Używasz leetcode.cn? Włącz obsługę, aby dodawać zadania.',
      enable: 'Włącz',
      dismiss: 'Odrzuć',
    },
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
    saveFailed: 'Nie udało się zapisać notatki. Wersja robocza została zachowana. Spróbuj zapisać ponownie.',
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
      theme: 'Motyw',
      themeSystem: 'Systemowy',
      themeLight: 'Jasny',
      themeDark: 'Ciemny',
      showBadge: 'Pokaż liczbę powtórek na ikonie',
    },

    // Review settings section
    reviewSettings: {
      title: 'Ustawienia powtórek',
      newCardsPerDay: 'Nowe karty dziennie',
    },

    problemAutoClear: {
      title: 'Resetowanie edytora zadania',
      description: 'Resetuj kod tylko podczas otwierania zadania z kolejki powtórek.',
      resetEditorOnReviewQueue: 'Resetuj edytor przy otwieraniu z kolejki powtórek',
    },

    leetcodeCn: {
      title: 'LeetCode Chiny',
      description: 'Włącz obsługę leetcode.cn (力扣). Wymaga dodatkowego uprawnienia przeglądarki.',
      enable: 'Włącz',
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
      // PAT field
      patLabel: 'Osobisty token dostępu',
      patPlaceholder: 'ghp_xxxxxxxxxxxx',
      patHelpLink: 'Utwórz token GitHub',
      // Gist selection
      gistIdLabel: 'ID Gista',
      gistIdPlaceholder: 'Wpisz istniejące ID Gista',
      createNewGist: 'Utwórz nowy Gist',
      // Sync controls
      syncEnabled: 'Synchronizacja',
      syncing: 'Synchronizowanie...',
      // Status
      lastSync: 'Ostatnia synchronizacja',
      lastSyncNever: 'Nigdy',
      // Errors
      syncFailed: 'Synchronizacja nie powiodła się',
      edit: 'Edytuj',
      cancel: 'Anuluj',
      latestEditNotice:
        'Najnowsza zmiana wygrywa dla całego zestawu danych. Równoczesne zmiany w innej przeglądarce mogą zostać utracone.',
      howSyncWorks: 'Jak działa synchronizacja',
      syncDetails:
        'LeetSRS porównuje czas edycji kompletnych zestawów danych i zastępuje starszy. Nie scala pojedynczych kart.',
      openGist: 'Otwórz Gist kopii zapasowej',
      destination: 'Miejsce docelowe',
      existingGist: 'Użyj istniejącego Gista',
      save: 'Zapisz',
      saving: 'Zapisywanie…',
      saved: 'Połączenie zapisane',
      saveFailed: 'Nie udało się zapisać połączenia',
      configFailed: 'Nie udało się wczytać zapisanego połączenia',
    },

    // About section
    about: {
      title: 'O aplikacji',
      feedbackMessage: 'Zgłaszaj propozycje funkcji, błędy i uwagi na GitHubie!',
      reviewRequest: 'Zostaw recenzję 🙏',
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
