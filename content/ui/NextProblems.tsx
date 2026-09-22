import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { FaArrowRight, FaLock } from 'react-icons/fa6';
import { background, type NextProblem } from '@/shared/background-service';
import type { Translations } from '@/shared/i18n';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { ProblemReference } from '@/shared/models';
import { getProblemTitle } from '@/shared/ui/problem-title';

// Proxy service property access creates a new function, so keep effect loaders stable.
const loadNextReview = (problem: ProblemReference) => background.getNextReview(problem);
const loadNextRoadmap = (problem: ProblemReference) => background.getNextRoadmapProblem(problem);

type LoadState<T> = { data: T; error?: never } | { data?: never; error: true } | undefined;

function useRecommendation<T>(
  load: (problem: ProblemReference) => Promise<T>,
  { frontendId, domain }: ProblemReference,
  saved: boolean
) {
  const [state, setState] = useState<LoadState<T>>();
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Saving and retrying refresh the recommendation.
  useEffect(() => {
    let active = true;
    setState(undefined);
    void load({ frontendId, domain }).then(
      (data) => {
        if (active) setState({ data });
      },
      () => {
        if (active) setState({ error: true });
      }
    );
    return () => {
      active = false;
    };
  }, [load, frontendId, domain, saved, attempt]);
  return { state, retry: () => setAttempt((value) => value + 1) };
}

export function NextProblems({ t, problem, saved }: { t: Translations; problem: ProblemReference; saved: boolean }) {
  const review = useRecommendation(loadNextReview, problem, saved);
  const roadmap = useRecommendation(loadNextRoadmap, problem, saved);
  return (
    <div className="rating-next">
      {!review.state || review.state.error ? (
        <RecommendationStatus
          message={review.state?.error ? t.contentScript.nextReviewFailed : t.contentScript.loadingNextReview}
          retry={review.state?.error ? review.retry : undefined}
          t={t}
        />
      ) : review.state.data ? (
        <ProblemLink label={t.contentScript.nextReview} problem={review.state.data} t={t} />
      ) : (
        <div className="rating-next-status">{t.contentScript.noOtherReviews}</div>
      )}
      {!roadmap.state || roadmap.state.error ? (
        <RecommendationStatus
          message={roadmap.state?.error ? t.contentScript.nextRoadmapFailed : t.contentScript.loadingNextRoadmap}
          retry={roadmap.state?.error ? roadmap.retry : undefined}
          t={t}
        />
      ) : roadmap.state.data ? (
        roadmap.state.data.problem ? (
          <ProblemLink
            label={t.contentScript.nextInRoadmap(roadmap.state.data.name)}
            problem={roadmap.state.data.problem}
            t={t}
          />
        ) : (
          <div className="rating-next-status">{t.contentScript.noNextRoadmapProblem(roadmap.state.data.name)}</div>
        )
      ) : null}
    </div>
  );
}

function RecommendationStatus({ message, retry, t }: { message: string; retry?: () => void; t: Translations }) {
  return (
    <div className="rating-next-status" role={retry ? 'alert' : undefined}>
      {message}
      {retry && <Button onPress={retry}>{t.contentScript.retry}</Button>}
    </div>
  );
}

function ProblemLink({ label, problem, t }: { label: string; problem: NextProblem; t: Translations }) {
  return (
    <a className="rating-next-link" href={getLeetcodeProblemUrl(problem)}>
      <span className="rating-next-copy">
        <span className="rating-next-label">{label}</span>
        <span className="rating-next-title">
          {problem.frontendId}. {getProblemTitle(problem, problem.domain)}
        </span>
      </span>
      {problem.isPaidOnly && <FaLock className="rating-next-icon" role="img" aria-label={t.roadmaps.paidOnly} />}
      <FaArrowRight className="rating-next-icon" aria-hidden="true" />
    </a>
  );
}
