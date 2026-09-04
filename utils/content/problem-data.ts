import type { Difficulty } from '@/shared/cards';
import { getCurrentDomain, getCurrentProblemSlug, getGraphQLUrl } from './domain';

export interface ExtractedProblemData {
  difficulty: Difficulty;
  title: string;
  titleSlug: string;
  questionFrontendId: string;
}

// Cache to avoid redundant requests
let cachedData: { slug: string; data: ExtractedProblemData } | null = null;

// Export for testing purposes
export function clearCache(): void {
  cachedData = null;
}

export async function extractProblemData(): Promise<ExtractedProblemData | null> {
  try {
    // Get the current slug from the URL or router
    const currentSlug = getCurrentProblemSlug();
    if (!currentSlug) {
      console.log('Could not extract title slug');
      return null;
    }
    const titleSlug = currentSlug;

    // Check cache first
    if (cachedData && cachedData.slug === titleSlug) {
      return cachedData.data;
    }

    const problemData = await fetchProblemDataFromPage(titleSlug);
    if (problemData) {
      // Update cache
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

async function fetchProblemDataFromPage(titleSlug: string): Promise<ExtractedProblemData | null> {
  try {
    // LeetCode's GraphQL endpoint
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

    // Get CSRF token from cookies
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
          difficulty: question.difficulty as ExtractedProblemData['difficulty'],
          title: useTranslated ? question.translatedTitle : question.title,
          titleSlug: question.titleSlug,
          questionFrontendId: question.questionFrontendId,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching problem data:', error);
    return null;
  }
}
