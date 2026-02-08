import type { Translations } from './index';

// Simplified Chinese translations
const zhCN: Translations = {
  app: {
    name: 'LeetSRS',
    namePart1: 'Leet',
    namePart2: 'SRS',
  },

  nav: {
    home: '首页',
    cards: '卡片',
    stats: '统计',
    settings: '设置',
  },

  actions: {
    save: '保存',
    saving: '保存中...',
    delete: '删除',
    deleting: '删除中...',
    confirm: '确认？',
    confirmDelete: '确认删除？',
    pause: '暂停',
    resume: '恢复',
    reload: '重新加载扩展',
  },

  states: {
    loading: '加载中...',
    new: '新卡片',
    learning: '学习中',
    review: '复习',
    relearning: '重新学习',
    unknown: '未知',
  },

  difficulty: {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  },

  ratings: {
    again: '重来',
    hard: '困难',
    good: '良好',
    easy: '简单',
  },

  errors: {
    somethingWentWrong: '出了点问题',
    unexpectedError: '发生了意外错误',
    errorDetails: '错误详情',
    failedToLoadReviewQueue: '加载复习队列失败',
    failedToExportData: '导出数据失败',
    failedToResetData: '重置数据失败',
    unknownError: '未知错误',
  },

  home: {
    loadingReviewQueue: '加载复习队列中...',
    noCardsToReview: '没有需要复习的卡片！',
    addProblemsInstructions: '在 LeetCode 上使用',
    addProblemsButton: '「提交」旁边的按钮添加题目。',
  },

  statsBar: {
    review: '复习',
    new: '新卡片',
    learn: '学习',
  },

  actionsSection: {
    title: '操作',
    delay1Day: '延后1天',
    delay5Days: '延后5天',
    deleteCard: '删除卡片',
  },

  notes: {
    title: '笔记',
    ariaLabel: '笔记内容',
    placeholderLoading: '加载中...',
    placeholderEmpty: '在此添加笔记...',
  },

  cardsView: {
    title: '卡片',
    filterAriaLabel: '筛选卡片',
    filterPlaceholder: '按名称或 ID 筛选...',
    clearFilterAriaLabel: '清除筛选',
    loadingCards: '加载卡片中...',
    noCardsAdded: '还没有添加卡片。',
    noCardsMatchFilter: '没有匹配的卡片。',
    cardPausedTitle: '卡片已暂停',
  },

  cardStats: {
    state: '状态',
    reviews: '复习次数',
    stability: '稳定性',
    lapses: '遗忘次数',
    difficulty: '难度',
    due: '到期',
    last: '上次',
    added: '添加时间',
  },

  statsView: {
    title: '统计',
  },

  charts: {
    cardDistribution: '卡片分布',
    reviewHistory: '近30天复习历史',
    upcomingReviews: '未来14天待复习',
    cardsDue: '到期卡片',
  },

  settings: {
    title: '设置',

    language: {
      title: '语言',
      label: '显示语言',
    },

    appearance: {
      title: '外观',
      darkMode: '深色模式',
      enableAnimations: '启用动画',
      showBadge: '在图标上显示待复习数量',
    },

    reviewSettings: {
      title: '复习设置',
      newCardsPerDay: '每日新卡片数量',
      dayStartHour: '新一天偏移（午夜后小时数）',
    },

    problemAutoClear: {
      title: '题目自动重置',
      description: '打开 LeetCode 题目时自动重置代码。',
      enableAutoReset: '启用自动重置',
    },

    data: {
      title: '数据',
      exportData: '导出数据',
      exporting: '导出中...',
      importData: '导入数据',
      importing: '导入中...',
      resetAllData: '重置所有数据',
      resetting: '重置中...',
      clickToConfirm: '再次点击以确认',
      importConfirmMessage: '确定要导入此数据吗？\n\n这将替换您当前的所有数据，包括卡片、复习历史和笔记。',
      importSuccess: '数据导入成功！',
      importFailed: '数据导入失败：',
      resetConfirmMessage:
        '您确定要删除所有数据吗？此操作无法撤销。\n\n您的所有卡片、复习历史、统计数据和笔记将被永久删除。',
      resetSuccess: '所有数据已重置',
    },

    gistSync: {
      title: 'GitHub Gist 同步',
      gistDescription: 'LeetSRS 备份 - 间隔重复数据',
      description: '通过 GitHub Gist 在不同浏览器间同步数据',
      patLabel: '个人访问令牌',
      patPlaceholder: 'ghp_xxxxxxxxxxxx',
      patHelpText: '在以下位置创建具有 "gist" 权限的令牌：',
      patHelpLink: 'GitHub 设置',
      validatePat: '验证',
      validating: '验证中...',
      patValid: '有效',
      patInvalid: '无效令牌',
      gistIdLabel: 'Gist ID',
      gistIdPlaceholder: '输入已有的 Gist ID 或创建新的',
      createNewGist: '创建新 Gist',
      creating: '创建中...',
      validateGist: '验证',
      gistValid: '有效',
      gistInvalid: '无效 Gist',
      enableSync: '启用自动同步',
      syncNow: '立即同步',
      syncing: '同步中...',
      lastSync: '上次同步',
      lastSyncNever: '从未',
      lastSyncPushed: '已推送',
      lastSyncPulled: '已拉取',
      patRequired: '启用同步需要个人访问令牌',
      gistRequired: '启用同步需要 Gist ID',
      syncFailed: '同步失败',
      createGistFailed: '创建 Gist 失败',
    },

    about: {
      title: '关于',
      feedbackMessage: '欢迎在 GitHub 上提交功能请求、错误报告和反馈！',
      reviewRequest: '如果 LeetSRS 对您有帮助，请留下评价？',
      copyright: '© 2026 Matt Drake',
      github: 'GitHub',
    },
  },

  contentScript: {
    addToSrsNoRating: '添加到 SRS（无评分）',
  },

  format: {
    leetcodeId: (id: string) => `#${id}`,
    stabilityDays: (days: string) => `${days}天`,
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
} as const;

export default zhCN;
