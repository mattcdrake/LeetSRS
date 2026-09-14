import { Rating } from '@/domain/ratings';
import type { Translations } from './index';

const hi: Translations = {
  // App branding
  syncNotices: {
    missingBackup: 'इस Gist में LeetSRS बैकअप नहीं है। सेटिंग्स में कोई दूसरा Gist चुनें।',
    creationFailed: 'GitHub ने बनाए गए Gist का ID नहीं लौटाया। फिर कोशिश करने से पहले अपने Gist जाँचें।',
    connectionSaveFailed: 'कनेक्शन सहेजा नहीं जा सका।',
    unavailable: 'आप सीखना जारी रख सकते हैं। GitHub उपलब्ध होने पर सिंक अपने आप फिर शुरू होगा।',
    rateLimit: 'GitHub API की सीमा पूरी हो गई है। बाद में फिर कोशिश करें। आप सीखना जारी रख सकते हैं।',
    authentication: 'सेटिंग्स में अपना GitHub टोकन और उसकी Gist अनुमति जाँचें।',
    missingToken: 'टोकन सेट नहीं है। सेटिंग्स में अपना GitHub टोकन जोड़ें।',
    missingGist: 'Gist ID सेट नहीं है। सेटिंग्स में एक Gist चुनें।',
    gistNotFound: 'Gist नहीं मिला। सेटिंग्स में Gist ID और टोकन की पहुँच जाँचें।',
    unknown: 'सिंक विफल रहा। बाद में फिर कोशिश करें।',
  },
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
    new: 'नया',
    learning: 'लर्निंग',
    review: 'रिव्यु',
    relearning: 'री-लर्निंग',
    unknown: 'अज्ञात',
  },
  // Rating buttons
  ratings: {
    [Rating.Again]: 'फिर से',
    [Rating.Hard]: 'हार्ड',
    [Rating.Good]: 'गुड',
    [Rating.Easy]: 'इज़ी',
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
    leetcodeCnBanner: {
      message: 'leetcode.cn यूज़ कर रहे हैं? प्रॉब्लम्स जोड़ने के लिए सपोर्ट ऑन करें।',
      enable: 'ऑन करें',
      dismiss: 'खारिज करें',
    },
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
    saveFailed: 'आपका नोट सहेजा नहीं जा सका। आपका ड्राफ़्ट सुरक्षित है। दोबारा सहेजने का प्रयास करें।',
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
      theme: 'थीम',
      themeSystem: 'सिस्टम',
      themeLight: 'हल्का',
      themeDark: 'गहरा',
      showBadge: 'आइकन पर ड्यू संख्या दिखाएँ',
    },
    // Review settings section
    reviewSettings: {
      title: 'रिव्यु सेटिंग्स',
      newCardsPerDay: 'प्रति दिन नए कार्ड',
    },
    problemAutoClear: {
      title: 'प्रश्न संपादक रीसेट',
      description: 'केवल समीक्षा कतार से प्रश्न खोलते समय कोड रीसेट करें।',
      resetEditorOnReviewQueue: 'समीक्षा कतार से खोलने पर संपादक रीसेट करें',
    },

    leetcodeCn: {
      title: 'LeetCode चीन',
      description: 'leetcode.cn (力扣) के लिए सपोर्ट ऑन करें। अतिरिक्त ब्राउज़र अनुमति आवश्यक है।',
      enable: 'ऑन करें',
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
      // PAT field
      patLabel: 'पर्सनल एक्सेस टोकन (PAT)',
      patPlaceholder: 'ghp_xxxxxxxxxxxx',
      patHelpLink: 'GitHub टोकन बनाएँ',
      // Gist selection
      gistIdLabel: 'Gist ID',
      gistIdPlaceholder: 'मौजूदा Gist ID डालें',
      createNewGist: 'नया Gist बनाएँ',
      // Sync controls
      syncEnabled: 'सिंक',
      syncing: 'सिंक हो रहा है...',
      // Status
      lastSync: 'लास्ट सिंक',
      lastSyncNever: 'कभी नहीं',
      // Errors
      syncFailed: 'सिंक फेल हो गया',
      edit: 'संपादित करें',
      cancel: 'रद्द करें',
      latestEditNotice: 'पूरे डेटा में सबसे नया बदलाव लागू होता है। दूसरे ब्राउज़र में उसी समय किए गए बदलाव खो सकते हैं।',
      howSyncWorks: 'सिंक कैसे काम करता है',
      syncDetails: 'LeetSRS पूरे डेटा के बदलाव का समय देखकर पुराने डेटा को बदल देता है। अलग-अलग कार्ड मर्ज नहीं किए जाते।',
      openGist: 'बैकअप Gist खोलें',
      destination: 'गंतव्य',
      existingGist: 'मौजूदा Gist का उपयोग करें',
      save: 'सहेजें',
      saving: 'सहेजा जा रहा है…',
      saved: 'कनेक्शन सहेजा गया',
      saveFailed: 'कनेक्शन सहेजा नहीं जा सका',
      configFailed: 'सहेजा गया कनेक्शन लोड नहीं हो सका',
    },
    // About section
    about: {
      title: 'अबाउट',
      feedbackMessage: 'फ़ीचर रिक्वेस्ट, बग रिपोर्ट और फ़ीडबैक के लिए GitHub पर issue खोलें!',
      reviewRequest: 'रिव्यू दें 🙏',
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
