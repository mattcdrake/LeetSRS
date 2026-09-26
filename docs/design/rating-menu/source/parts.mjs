// Shared icons, strings and data for the mockups.
const svg = (d, cls = 'size-4', sw = 2) =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  check: (c) => svg('<path d="M20 6 9 17l-5-5"/>', c, 2.4),
  arrow: (c) => svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', c),
  lock: (c) => svg('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', c),
  plus: (c) => svg('<path d="M5 12h14"/><path d="M12 5v14"/>', c),
  review: (c) => svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', c),
  route: (c) => svg('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>', c),
  alert: (c) => svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', c),
  yt: (c) => svg('<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>', c),
  undo: (c) => svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>', c),
  enter: (c) => svg('<path d="m9 10-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>', c),
  x: (c) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', c),
  logo: (c) =>
    svg('<path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5"/><path d="M5.63 7.16l0 .01"/><path d="M4.06 11l0 .01"/><path d="M4.63 15.1l0 .01"/><path d="M7.16 18.37l0 .01"/><path d="M11 19.94l0 .01"/>', c),
};

export const RATING = {
  light: { 1: '#c73e3e', 2: '#d97706', 3: '#4271c4', 4: '#3d9156' },
  dark: { 1: '#d14358', 2: '#e88c3a', 3: '#5b8fd9', 4: '#52b169' },
};

// NEW marks proposed strings that do not exist in shared/i18n yet.
export const S = {
  en: {
    how: 'How did it go?',
    ratings: { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' },
    desc: { 1: 'Needed the solution', 2: 'Solved with effort', 3: 'Recalled the approach', 4: 'Felt effortless' },
    days: (d) => `${d} ${d === 1 ? 'day' : 'days'}`,
    short: (d) => `${d}d`,
    inDays: (d) => `in ${d} ${d === 1 ? 'day' : 'days'}`, // NEW
    without: 'Save without rating',
    hint: 'Opens after each accepted solve.', // reworded
    off: 'Turn off',
    saved: 'Saved',
    savedAs: (r) => `Saved as ${r}`, // NEW
    reviewIn: (d) => `Review in ${d} ${d === 1 ? 'day' : 'days'}`,
    date: 'Tue, Sep 29',
    undo: 'Undo', // NEW
    upNext: 'Up next', // NEW
    nextReview: 'Next review',
    nextIn: (n) => `Next in ${n}`,
    noReviews: 'No other reviews due',
    noRoadmap: (n) => `No new problems in ${n}`,
    loadFailed: 'Couldn’t load rating options.', // NEW
    saveFailed: 'Couldn’t save. Pick a rating to try again.', // NEW
    retry: 'Try again',
    tooltip: 'LeetSRS',
    tooltipSub: 'Rate this problem', // NEW
    toast: 'Code reset for today’s review', // NEW + localized
    caption: 'Pick how it felt — keys 1–4',
    dueToday: 'Due today', // NEW
    choose: 'Next review',
    esc: 'close',
    rate: 'rate',
  },
  zh: {
    how: '这次做得怎么样？',
    ratings: { 1: '重来', 2: '困难', 3: '良好', 4: '简单' },
    desc: { 1: '需要查看题解', 2: '解题较费力', 3: '记得解题思路', 4: '轻松解决' },
    days: (d) => `${d} 天`,
    short: (d) => `${d}天`,
    inDays: (d) => `${d} 天后`,
    without: '保存但不评分',
    hint: '每次通过后自动打开。',
    off: '关闭',
    saved: '已保存',
    savedAs: (r) => `已保存为「${r}」`,
    reviewIn: (d) => `${d} 天后复习`,
    date: '9月29日 周二',
    undo: '撤销',
    upNext: '接下来',
    nextReview: '下一道复习题',
    nextIn: (n) => `${n} 中的下一题`,
    noReviews: '没有其他待复习题目',
    noRoadmap: (n) => `${n} 中没有新题目`,
    loadFailed: '无法加载评分选项。',
    saveFailed: '保存失败，请重新选择评分。',
    retry: '重试',
    tooltip: 'LeetSRS',
    tooltipSub: '为本题评分',
    toast: '已为今日复习重置代码',
    caption: '选择感受 · 按 1–4',
    dueToday: '今日到期',
    choose: '下次复习',
    esc: '关闭',
    rate: '评分',
  },
};

export const DATA = {
  problem: { id: '347', title: 'Top K Frequent Elements', zh: '前 K 个高频元素' },
  intervals: { 1: 1, 2: 2, 3: 3, 4: 8 },
  review: { id: '20', title: 'Valid Parentheses' },
  roadmap: { name: 'Blind 75', id: '271', title: 'Encode and Decode Strings', paid: true },
};
