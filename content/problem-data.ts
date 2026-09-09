import { z } from 'zod';
import { type ProblemDescriptor, problemDescriptorSchema } from '@/domain/cards';
import { getCurrentDomain, getCurrentProblemSlug } from './page-context';

const questionResponseSchema = z.object({
  data: z.object({
    question: z.object({
      questionFrontendId: problemDescriptorSchema.shape.leetcodeId,
      title: problemDescriptorSchema.shape.name,
      translatedTitle: problemDescriptorSchema.shape.name.or(z.literal('')).nullish(),
      titleSlug: problemDescriptorSchema.shape.slug,
      difficulty: problemDescriptorSchema.shape.difficulty,
    }),
  }),
});

export async function getCurrentProblem(): Promise<ProblemDescriptor | null> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  return fetchProblemData(slug);
}

async function fetchProblemData(titleSlug: string): Promise<ProblemDescriptor | null> {
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

    const domain = getCurrentDomain();
    const response = await fetch(`https://${domain}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) return null;

    const {
      data: { question },
    } = questionResponseSchema.parse(await response.json());

    return {
      difficulty: question.difficulty,
      name: domain === 'leetcode.cn' ? question.translatedTitle || question.title : question.title,
      slug: question.titleSlug,
      leetcodeId: question.questionFrontendId,
      domain,
    };
  } catch {
    return null;
  }
}
