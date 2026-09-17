import { Rating } from 'ts-fsrs';
import type { Translations } from './index';
import { patMigration } from './legacy/zh-CN';
import { getTopicLabel } from './topic-labels';

// Simplified Chinese translations
const zhCN: Translations = {
  topicLabel: (topic: string) => getTopicLabel(topic, 'zh-CN'),
  syncNotices: {
    missingBackup: '此 Gist 不含 LeetSRS 备份。请在设置中选择其他 Gist。',
    creationFailed: 'GitHub 未返回已创建 Gist 的 ID。重试前请检查你的 Gist。',
    connectionSaveFailed: '无法保存连接。',
    unavailable: '你可以继续学习。GitHub 恢复可用后将自动继续同步。',
    rateLimit: '已达到 GitHub API 请求上限。请稍后重试。你可以继续学习。',
    authentication: '请在设置中重新登录 GitHub。',
    missingToken: '请在设置中登录 GitHub。',
    gistNotFound: '未找到备份。请在设置中选择可用的备份。',
    unknown: '同步失败，请稍后重试。',
  },
  app: {
    name: 'LeetSRS',
    namePart1: 'Leet',
    namePart2: 'SRS',
  },

  nav: {
    home: '首页',
    roadmaps: '学习路线',
    cards: '卡片',
    settings: '设置',
  },

  roadmaps: {
    activate: '启用',
    deactivate: '停用',
    active: '当前',
    use: '使用',
    add: '加入 SRS',
    addProblem: (title: string) => `将 ${title} 加入 SRS`,
    addFailed: '无法将题目加入 SRS，请重试。',
    searchLabel: '搜索学习路线题目',
    filters: { notInSrs: '未加入 SRS', inSrs: '已加入 SRS', reviewed: '已复习', skipped: '已跳过' },
    noMatches: '没有匹配的题目。',
    detailLoadFailed: '无法加载学习路线题目，请重试。',
    skipFailed: '无法保存跳过的题目，请重试。',
    skip: '跳过',
    restore: '恢复',
    skipProblem: (title: string) => `跳过 ${title}`,
    restoreProblem: (title: string) => `恢复 ${title}`,
    paidOnly: '付费题目',
    problem: (id: string) => `题目 ${id}`,
    unavailable: (domain: string) => `${domain} 暂不提供此题`,
    open: (name: string) => `打开 ${name}`,
    activationLabel: (name: string) => `使用 ${name}`,
    reviewed: (count: number, total: number) => `已复习 ${count} / ${total} 题`,
    back: '返回所有学习路线',
    loading: '正在加载学习路线...',
    loadFailed: '无法加载学习路线。',
    saveFailed: '无法保存当前学习路线，请重试。',
    retry: '重试',
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
    new: '新卡片',
    learning: '学习中',
    review: '复习',
    relearning: '重新学习',
    unknown: '未知',
  },

  ratings: {
    [Rating.Again]: '重来',
    [Rating.Hard]: '困难',
    [Rating.Good]: '良好',
    [Rating.Easy]: '简单',
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
    currentRoadmap: '当前学习路线',
    nextProblem: '学习路线中的下一题',
    viewRoadmap: '查看学习路线',
    roadmapReviewed: (count: number, total: number) => `已复习 ${count} / ${total} 题`,
    activateRoadmapSuggestion: {
      before: '启用一条',
      link: '学习路线',
      after: '，找到下一道要练习的题目。',
    },
    noNextProblem: (domain: string) => `${domain} 上没有尚未加入 SRS 且未跳过的可用题目。`,
    loadingReviewQueue: '加载复习队列中...',
    noCardsToReview: '没有需要复习的卡片！',
    addProblemsInstructions: '在 LeetCode 上使用',
    addProblemsButton: '「提交」旁边的按钮添加题目。',
    leetcodeCnBanner: {
      message: '使用力扣中国站？启用支持以添加题目。',
      enable: '启用',
      dismiss: '关闭',
    },
  },

  statsBar: {
    review: '复习',
    new: '新卡片',
  },

  actionsSection: {
    postpone: '推迟复习',
    pauseCard: '暂停卡片',
    title: '操作',
    delay1Day: '延后1天',
    delay5Days: '延后5天',
    deleteCard: '删除卡片',
  },

  notes: {
    saveFailed: '无法保存笔记。草稿已保留，请重新保存。',
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
    filters: { due: '到期', new: '新卡片', paused: '已暂停' },
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

  settings: {
    preferences: '偏好设置',
    title: '设置',

    language: {
      label: '显示语言',
    },

    appearance: {
      theme: '主题',
      themeSystem: '跟随系统',
      themeLight: '浅色',
      themeDark: '深色',
    },

    reviewSettings: {
      openRatingAfterSolving: '解题后打开评分面板',
      newCardsPerDay: '每日新卡片数量',
    },

    editorReset: {
      resetEditorOnReviewQueue: '复习时重置代码',
    },
    preferredLeetcodeSite: '首选 LeetCode 站点',
    leetcodeCn: {
      description: '启用 leetcode.cn（力扣）支持。需要额外的浏览器权限。',
      enable: '启用',
    },

    data: {
      title: '数据与备份',
      description: '保存备份或恢复已有备份。',
      exportData: '导出备份',
      exporting: '导出中...',
      importData: '导入备份',
      importing: '导入中...',
      resetAllData: '重置所有数据',
      resetAction: '重置…',
      resetDescription: '永久删除已保存的数据。',
      resetting: '重置中...',
      importConfirmMessage: '确定要导入此数据吗？\n\n这将替换您当前的所有数据，包括卡片、复习历史和笔记。',
      importSuccess: '数据导入成功！',
      importFailed: '数据导入失败：',
      resetConfirmMessage:
        '您确定要删除所有数据吗？此操作无法撤销。\n\n您的所有卡片、复习历史、统计数据和笔记将被永久删除。',
      resetSuccess: '所有数据已重置',
    },

    gistSync: {
      permissionRequired: 'GitHub 访问权限已移除。请重新启用以恢复备份同步。',
      enableAccess: '启用 GitHub 访问权限',
      permissionFailed: '未能获得 GitHub 访问权限。请重试登录或启用 GitHub 访问权限；本地练习仍然可用。',
      signIn: '使用 GitHub 登录',
      signingIn: '正在登录…',
      signOut: '退出登录',
      signInFailed: '登录未完成，请重试。',
      ...patMigration,
      chooseBackup: '选择备份',
      previousBackup: '上次的备份',
      loadingBackups: '正在加载备份…',
      loadBackupsFailed: '无法加载备份。',
      retry: '重试',
      connectAndSync: '连接并同步',

      title: 'GitHub Gist 同步',
      gistDescription: 'LeetSRS 备份 - 间隔重复数据',
      createNewGist: '创建新 Gist',
      syncEnabled: '同步',
      syncing: '同步中...',
      lastSync: '上次同步',
      lastSyncNever: '从未',
      syncFailed: '同步失败',
      cancel: '取消',
      syncDetails: 'LeetSRS 比较完整数据集的编辑时间，并用较新的数据替换较旧的数据。不会逐张卡片合并。',
      openGist: '打开备份 Gist',
      open: '打开',
      change: '更改',
      destination: '备份 Gist',
      syncInfo: '同步方式',
      save: '保存',
      saving: '正在保存…',
      saved: '连接已保存',
      saveFailed: '无法保存连接',
    },

    about: {
      title: '关于',
      feedbackLink: '报告问题或提出功能建议',
      reviewRequest: '评价 LeetSRS',
      copyright: '© 2026 Matt Drake',
      github: '在 GitHub 上点 Star',
      discord: '加入 Discord',
    },
  },

  contentScript: {
    howDidItGo: '这次做得怎么样？',
    descriptions: { 1: '需要查看题解', 2: '解题较费力', 3: '记得解题思路', 4: '轻松解决' },
    saveWithoutRating: '保存但不评分',
    autoOpenHint: '解题后自动打开。',
    turnOffAutoOpen: '关闭自动打开',
    saved: '已保存',
    retry: '重试',
    days: (days: number) => `${days} 天`,
    reviewIn: (days: number) => `${days} 天后复习`,

    saveFailed: '无法保存这道题目，请重试。',
  },

  format: {
    leetcodeId: (id: string) => `#${id}`,
    stabilityDays: (days: string) => `${days}天`,
    characterCount: (count: number, max: number) => `${count}/${max}`,
    version: (version: string) => `v${version}`,
  },
} as const;

export default zhCN;
