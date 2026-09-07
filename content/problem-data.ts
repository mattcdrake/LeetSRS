import type { ProblemDescriptor } from '@/domain/cards';
import { getCurrentDomain, getCurrentProblemSlug, getGraphQLUrl } from './domain';

let cachedData: { slug: string; data: ProblemDescriptor } | null = null;

export function clearCache(): void {
  cachedData = null;
}

export async function getCurrentProblem(): Promise<ProblemDescriptor | null> {
  const slug = getCurrentProblemSlug();
  if (!slug) return null;
  if (cachedData?.slug === slug) return cachedData.data;

  const problem = await fetchProblemDataFromPage(slug);
  if (problem) cachedData = { slug, data: problem };
  return problem;
}

async function fetchProblemDataFromPage(titleSlug: string): Promise<ProblemDescriptor | null> {
  try {
    const graphqlQuery = {
      query: `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            questionFrontendId
            title
            translatedTitle
            titleSlug
            difficulty
          }
        }
      `,
      variables: {
        titleSlug,
      },
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

    if (response.ok) {
      const data = await response.json();
      const question = data?.data?.question;

      if (question) {
        const useTranslated = getCurrentDomain() === 'leetcode.cn' && question.translatedTitle;
        return {
          difficulty: question.difficulty as ProblemDescriptor['difficulty'],
          name: useTranslated ? question.translatedTitle : question.title,
          slug: question.titleSlug,
          leetcodeId: question.questionFrontendId,
          domain: getCurrentDomain(),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
