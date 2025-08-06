import type { Difficulty } from '@/shared/cards';

export interface ProblemData {
  difficulty: Difficulty;
  title: string;
  titleSlug: string;
  questionFrontendId: string;
}

export function extractProblemData(): ProblemData | null {
  const nextDataScript = document.getElementById('__NEXT_DATA__');

  if (!nextDataScript || !nextDataScript.textContent) {
    console.log('__NEXT_DATA__ script not found');
    return null;
  }

  try {
    const data = JSON.parse(nextDataScript.textContent);

    // Try to find the question data
    if (data.props?.pageProps?.dehydratedState?.queries) {
      for (const query of data.props.pageProps.dehydratedState.queries) {
        if (query.state?.data?.question) {
          const question = query.state.data.question;
          return {
            difficulty: question.difficulty as Difficulty,
            title: question.title,
            titleSlug: question.titleSlug,
            questionFrontendId: question.questionFrontendId,
          };
        }
      }
    }

    console.log('Problem data not found in expected location');
    return null;
  } catch (error) {
    console.error('Error parsing __NEXT_DATA__:', error);
    return null;
  }
}
