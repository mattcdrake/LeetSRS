import type { ProblemDescriptor } from '@/domain/cards';
import { getCurrentDomain, getCurrentProblemSlug, getGraphQLUrl } from './domain';

export async function getCurrentProblem(): Promise<ProblemDescriptor | null> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  return fetchProblemDataFromPage(slug);
}

async function fetchProblemDataFromPage(titleSlug: string): Promise<ProblemDescriptor | null> {
  try {
    const graphqlQuery = {
      query: `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionFrontendId
            title
            translatedTitle
            titleSlug
            difficulty
          }
        }
      `,
      variables: { titleSlug },
    };

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
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const question = data?.data?.question;
    if (!question) return null;

    const domain = getCurrentDomain();
    const useTranslated = domain === 'leetcode.cn' && question.translatedTitle;
    return {
      difficulty: question.difficulty as ProblemDescriptor['difficulty'],
      name: useTranslated ? question.translatedTitle : question.title,
      slug: question.titleSlug,
      leetcodeId: question.questionFrontendId,
      domain,
    };
  } catch {
    return null;
  }
}
