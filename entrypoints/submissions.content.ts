import { ACCEPTED_SUBMISSION_MESSAGE, observeSubmissions } from '@/content/submission-observer';

export default defineContentScript({
  matches: ['*://*.leetcode.com/*', '*://*.leetcode.cn/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    observeSubmissions((submission) => {
      window.postMessage({ type: ACCEPTED_SUBMISSION_MESSAGE, ...submission }, window.location.origin);
    });
  },
});
