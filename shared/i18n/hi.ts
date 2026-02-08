import type { Translations } from './index';

const hi: Translations = {
  // App branding
  app: {
    name: 'LeetSRS',
    namePart1: 'Leet',
    namePart2: 'SRS',
  },
  // Navigation
  nav: {
    home: 'होम',
    cards: 'कार्ड्स',
    stats: 'स्टैट्स',
    settings: 'सेटिंग्स',
  },
  // Common actions
  actions: {
    save: 'सेव करें',
    saving: 'सेव हो रहा है...',
    delete: 'डिलीट करें',
    deleting: 'डिलीट हो रहा है...',
    confirm: 'कन्फर्म करें?',
    confirmDelete: 'डिलीट कन्फर्म करें?',
    pause: 'पॉज़ करें',
    resume: 'रिज़्यूम करें',
    reload: 'एक्सटेंशन रीलोड करें',
  },
  // Common states
  states: {
    loading: 'लोड हो रहा है...',
    new: 'नया',
    learning: 'लर्निंग',
    review: 'रिव्यु',
    relearning: 'री-लर्निंग',
    unknown: 'अज्ञात',
  },
  // Difficulty levels
  difficulty: {
    easy: 'आसान',
    medium: 'मीडियम',
    hard: 'हार्ड',
  },
  // Rating buttons
  ratings: {
    again: 'फिर से',
    hard: 'हार्ड',
    good: 'गुड',
    easy: 'इज़ी',
  },
  // Error boundary
  errors: {
    somethingWentWrong: 'कुछ गलत हो गया',
    unexpectedError: 'एक अनपेक्षित एरर आया',
    errorDetails: 'एरर डीटेल्स',
    failedToLoadReviewQueue: 'रिव्यु कतार लोड करने में विफल',
    failedToExportData: 'डेटा एक्सपोर्ट करने में विफल',
    failedToResetData: 'डेटा रीसेट करने में विफल',
    unknownError: 'अननोन एरर',
  },
  // Home view - Review queue
  home: {
    loadingReviewQueue: 'रिव्यु कतार लोड हो रही है...',
    noCardsToReview: 'रिव्यु के लिए कोई कार्ड नहीं!',
    addProblemsInstructions: 'LeetCode पर प्रॉब्लम्स जोड़ें',
    addProblemsButton: "'Submit' के बगल वाले बटन से।",
  },
  // Home view - Stats bar
  statsBar: {
    review: 'रिव्यु',
    new: 'नया',
    learn: 'लर्न',
  },
  // Home view - Actions section
  actionsSection: {
    title: 'एक्शन्स',
    delay1Day: '1 दिन',
    delay5Days: '5 दिन',
    deleteCard: 'कार्ड डिलीट करें',
  },
  // Home view - Notes section
  notes: {
    title: 'नोट्स',
    ariaLabel: 'नोट टेक्स्ट',
    placeholderLoading: 'लोड हो रहा है...',
    placeholderEmpty: 'अपने नोट्स यहाँ लिखें...',
  },
  // Cards view
  cardsView: {
    title: 'कार्ड्स',
    filterAriaLabel: 'कार्ड फ़िल्टर करें',
    filterPlaceholder: 'नाम या ID से फ़िल्टर करें...',
    clearFilterAriaLabel: 'फ़िल्टर साफ़ करें',
    loadingCards: 'कार्ड लोड हो रहे हैं...',
    noCardsAdded: 'अभी तक कोई कार्ड नहीं जोड़ा गया।',
    noCardsMatchFilter: 'कोई कार्ड आपके फ़िल्टर से मैच नहीं करता।',
    cardPausedTitle: 'कार्ड पॉज़्ड है',
  },
  // Card stats labels
  cardStats: {
    state: 'स्टेट',
    reviews: 'रिव्युज़',
    stability: 'स्टेबिलिटी',
    lapses: 'लैप्स',
    difficulty: 'डिफिकल्टी',
    due: 'ड्यू',
    last: 'लास्ट',
    added: 'जोड़ा गया',
  },
  // Stats view
  statsView: {
    title: 'स्टैट्स',
  },
  // Charts
  charts: {
    cardDistribution: 'कार्ड डिस्ट्रीब्यूशन',
    reviewHistory: 'पिछले 30 दिनों की रिव्यु हिस्ट्री',
    upcomingReviews: 'आगामी रिव्युज़ (अगले 14 दिन)',
    cardsDue: 'ड्यू कार्ड्स',
  },
  // Settings view
  settings: {
    title: 'सेटिंग्स',
    // Language section
    language: {
      title: 'भाषा',
      label: 'डिस्प्ले भाषा',
    },
    // Appearance section
    appearance: {
      title: 'अपीयरेंस',
      darkMode: 'डार्क मोड',
      enableAnimations: 'एनिमेशन ऑन करें',
      showBadge: 'आइकन पर ड्यू संख्या दिखाएँ',
    },
    // Review settings section
    reviewSettings: {
      title: 'रिव्यु सेटिंग्स',
      newCardsPerDay: 'प्रति दिन नए कार्ड',
      dayStartHour: 'अगले दिन का ऑफ़सेट (मध्यरात्रि के बाद घंटे)',
    },
    problemAutoClear: {
      title: 'प्रॉब्लम ऑटो रीसेट',
      description: 'LeetCode प्रॉब्लम खोलने पर कोड ऑटोमैटिकली रीसेट करें।',
      enableAutoReset: 'ऑटो रीसेट ऑन करें',
    },
    // Data section
    data: {
      title: 'डेटा',
      exportData: 'डेटा एक्सपोर्ट करें',
      exporting: 'एक्सपोर्ट हो रहा है...',
      importData: 'डेटा इम्पोर्ट करें',
      importing: 'इम्पोर्ट हो रहा है...',
      resetAllData: 'सारा डेटा रीसेट करें',
      resetting: 'रीसेट हो रहा है...',
      clickToConfirm: 'कन्फर्म करने के लिए फिर क्लिक करें',
      importConfirmMessage:
        'क्या आप वाकई यह डेटा इम्पोर्ट करना चाहते हैं?\n\nइससे आपका सारा मौजूदा डेटा रिप्लेस हो जाएगा, जिसमें कार्ड, रिव्यु हिस्ट्री और नोट्स शामिल हैं।',
      importSuccess: 'डेटा सफलतापूर्वक इम्पोर्ट हो गया!',
      importFailed: 'डेटा इम्पोर्ट करने में विफल:',
      resetConfirmMessage:
        'क्या आप पूरी तरह श्योर हैं कि सारा डेटा डिलीट करना चाहते हैं? यह एक्शन अनडू नहीं किया जा सकता।\n\nआपके सभी कार्ड, रिव्यु हिस्ट्री, स्टैट्स और नोट्स पर्मानेंटली डिलीट हो जाएँगे।',
      resetSuccess: 'सारा डेटा रीसेट हो गया',
    },
    // GitHub Gist Sync section
    gistSync: {
      title: 'GitHub Gist सिंक',
      gistDescription: 'LeetSRS बैकअप - स्पेस्ड रिपिटिशन डेटा',
      description: 'GitHub Gists का यूज़ करके ब्राउज़रों में डेटा सिंक करें',
      // PAT field
      patLabel: 'पर्सनल एक्सेस टोकन (PAT)',
      patPlaceholder: 'ghp_xxxxxxxxxxxx',
      patHelpText: '"gist" स्कोप के साथ टोकन बनाएँ',
      patHelpLink: 'GitHub सेटिंग्स',
      validatePat: 'वैलिडेट',
      validating: 'वैलिडेटिंग...',
      patValid: 'वैलिड',
      patInvalid: 'इनवैलिड टोकन',
      // Gist selection
      gistIdLabel: 'Gist ID',
      gistIdPlaceholder: 'मौजूदा Gist ID डालें या नया बनाएँ',
      createNewGist: 'नया Gist बनाएँ',
      creating: 'क्रिएट हो रहा है...',
      validateGist: 'वैलिडेट',
      gistValid: 'वैलिड',
      gistInvalid: 'इनवैलिड Gist',
      // Sync controls
      enableSync: 'ऑटोमैटिक सिंक ऑन करें',
      syncNow: 'अभी सिंक करें',
      syncing: 'सिंक हो रहा है...',
      // Status
      lastSync: 'लास्ट सिंक',
      lastSyncNever: 'कभी नहीं',
      lastSyncPushed: 'पुश किया',
      lastSyncPulled: 'पुल किया',
      // Errors
      patRequired: 'सिंक ऑन करने के लिए PAT ज़रूरी है',
      gistRequired: 'सिंक ऑन करने के लिए Gist ID ज़रूरी है',
      syncFailed: 'सिंक फेल हो गया',
      createGistFailed: 'Gist बनाने में फेल',
    },
    // About section
    about: {
      title: 'अबाउट',
      feedbackMessage: 'फ़ीचर रिक्वेस्ट, बग रिपोर्ट और फ़ीडबैक के लिए GitHub पर issue खोलें!',
      reviewRequest: 'अगर LeetSRS से मदद मिली, तो एक रिव्यु दें?',
      copyright: '© 2026 Matt Drake',
      github: 'GitHub',
    },
  },
  // Content script (LeetCode page integration)
  contentScript: {
    addToSrsNoRating: 'SRS में जोड़ें (बिना रेटिंग)',
  },
  // Formatting helpers (for interpolated strings)
  format: {
    leetcodeId: (id: string) => `#${id}`,
    stabilityDays: (days: string) => `${days}दि`,
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
} as const;

export default hi;
