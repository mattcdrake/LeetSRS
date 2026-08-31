import { MessageType, sendMessage } from '@/shared/messages';
import { getCurrentDomain, getCurrentProblemSlug, getGraphQLUrl } from './domain';

const SLUG_CHECK_INTERVAL_MS = 250;

export interface LeetcodeEditorStateIdentifiers {
  questionFrontendId?: string;
  questionId?: string;
}

export function getLeetcodeEditorStateKeys(
  storageArea: Storage,
  identifiers: LeetcodeEditorStateIdentifiers
): string[] {
  const keys: string[] = [];

  for (let index = 0; index < storageArea.length; index += 1) {
    const key = storageArea.key(index);
    if (!key || !isLeetcodeEditorStateKey(key, identifiers)) {
      continue;
    }
    keys.push(key);
  }

  return keys;
}

export function isLeetcodeEditorStateKey(key: string, identifiers: LeetcodeEditorStateIdentifiers): boolean {
  if (identifiers.questionFrontendId && key.startsWith(`${identifiers.questionFrontendId}_`) && key.endsWith('_code')) {
    return true;
  }

  if (identifiers.questionId) {
    const ugcPattern = new RegExp(`^ugc_.+_${escapeRegExp(identifiers.questionId)}_[^_]+_code$`);
    return ugcPattern.test(key);
  }

  return false;
}

export function clearLeetcodeEditorState(identifiers: LeetcodeEditorStateIdentifiers): string[] {
  const keys = getLeetcodeEditorStateKeys(localStorage, identifiers);
  for (const key of keys) {
    localStorage.removeItem(key);
  }
  return keys;
}

export function setupClearEditorOnReview(): () => void {
  let lastProcessedSlug: string | null = null;

  const checkCurrentProblem = () => {
    const slug = getCurrentProblemSlug();
    if (!slug) {
      lastProcessedSlug = null;
      return;
    }

    if (slug === lastProcessedSlug) {
      return;
    }

    lastProcessedSlug = slug;
    void clearEditorIfDueForReview(slug);
  };

  checkCurrentProblem();

  const intervalId = window.setInterval(checkCurrentProblem, SLUG_CHECK_INTERVAL_MS);
  window.addEventListener('popstate', checkCurrentProblem);
  window.addEventListener('pageshow', checkCurrentProblem);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('popstate', checkCurrentProblem);
    window.removeEventListener('pageshow', checkCurrentProblem);
  };
}

async function clearEditorIfDueForReview(slug: string): Promise<void> {
  try {
    const decision = await sendMessage({
      type: MessageType.GET_CLEAR_EDITOR_ON_REVIEW_DECISION,
      slug,
      domain: getCurrentDomain(),
    });

    if (!decision.shouldClear) {
      return;
    }

    clearLeetcodeEditorState({ questionFrontendId: decision.questionFrontendId });

    const questionId = await fetchQuestionId(slug);
    if (questionId) {
      clearLeetcodeEditorState({ questionId });
    }
  } catch (error) {
    console.error('Failed to clear LeetCode editor state:', error);
  }
}

async function fetchQuestionId(titleSlug: string): Promise<string | undefined> {
  try {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }

    const response = await fetch(getGraphQLUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operationName: 'questionDetail',
        query: `
          query questionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionId
            }
          }
        `,
        variables: { titleSlug },
      }),
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();
    const questionId = data?.data?.question?.questionId;
    return typeof questionId === 'string' ? questionId : undefined;
  } catch {
    return undefined;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
