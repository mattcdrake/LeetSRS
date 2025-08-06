import type { Difficulty } from '@/shared/cards';

export interface ProblemData {
  difficulty: Difficulty;
  title: string;
  titleSlug: string;
  questionFrontendId: string;
}

// Cache to avoid redundant requests
let cachedData: { slug: string; data: ProblemData } | null = null;

// Export for testing purposes
export function clearCache(): void {
  cachedData = null;
}

export async function extractProblemData(): Promise<ProblemData | null> {
  try {
    // Get the current slug from the URL or router
    const titleSlug = getCurrentTitleSlug();
    if (!titleSlug) {
      console.log('Could not extract title slug');
      return null;
    }

    // Check cache first
    if (cachedData && cachedData.slug === titleSlug) {
      return cachedData.data;
    }

    // Make async GraphQL request for fresh data
    const problemData = await fetchProblemData(titleSlug);
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

function getCurrentTitleSlug(): string | null {
  // Try window.next.router first (most reliable after navigation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextRouter = (window as any).next?.router;
  if (nextRouter?.query?.slug) {
    return nextRouter.query.slug;
  }

  // Fallback to URL parsing
  const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
  return pathMatch ? pathMatch[1] : null;
}

async function fetchProblemData(titleSlug: string): Promise<ProblemData | null> {
  try {
    // LeetCode's GraphQL endpoint
    const graphqlQuery = {
      query: `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            questionFrontendId
            title
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

    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify(graphqlQuery),
    });

    if (response.ok) {
      const data = await response.json();
      const question = data?.data?.question;

      if (question) {
        return {
          difficulty: question.difficulty as Difficulty,
          title: question.title,
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
