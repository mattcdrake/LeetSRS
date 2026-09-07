import { bootstrapContent } from '@/content/bootstrap';

export default defineContentScript({
  matches: ['*://*.leetcode.com/*', '*://*.leetcode.cn/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main: bootstrapContent,
});
