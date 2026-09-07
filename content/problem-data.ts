import type { ProblemDescriptor } from '@/domain/cards';
import { getCurrentDomain, getCurrentProblemSlug, getGraphQLUrl } from './domain';

let cachedData: { slug: string; data: ProblemDescriptor } | null = null;

export function clearCache(): void {
  cachedData = null;
}

export async function getCurrentProblem(): Promise<ProblemDescriptor | null> {
  try {
    const currentSlug = getCurrentProblemSlug();
    if (!currentSlug) {
      console.log('Could not extract title slug');
      return null;
    }
    const titleSlug = currentSlug;

    if (cachedData && cachedData.slug === titleSlug) {
      return cachedData.data;
    }

    const problemData = await fetchProblemDataFromPage(titleSlug);
    if (problemData) {
      cachedData = { slug: titleSlug, data: problemData };
      return problemData;
    }

    console.log('Problem data not found');
    return null;
  } catch (error) {
    console.error('Error extracting problem data:', error);
    return null;
  }
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
        titleSlug: titleSlug,
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
  } catch (error) {
    console.error('Error fetching problem data:', error);
    return null;
  }
}
