import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { FaArrowRight, FaLock } from 'react-icons/fa6';
import { background, type NextProblem } from '@/shared/background-service';
import type { Translations } from '@/shared/i18n';
import type { ProblemReference } from '@/shared/learning-document';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { getProblemTitle } from '@/shared/ui/problem-title';

type Props = { t: Translations; problem: ProblemReference; saved: boolean };
type Recommendation = { name?: string; problem: NextProblem | null };

export function NextProblems(props: Props) {
  return (
    <div className="border-t border-(--panel-border) px-[5px] py-1">
      <NextProblemRow {...props} kind="review" />
      <NextProblemRow {...props} kind="roadmap" />
    </div>
  );
}

function NextProblemRow({ t, problem: { frontendId, domain }, saved, kind }: Props & { kind: 'review' | 'roadmap' }) {
  const [data, setData] = useState<Recommendation | null>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Saving and retrying refresh the recommendation.
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(false);
    const current = { frontendId, domain };
    const request =
      kind === 'review'
        ? background.getNextReview(current).then((problem) => ({ problem }))
        : background.getNextRoadmapProblem(current);
    void request.then(
      (data) => {
        if (active) setData(data);
      },
      () => {
        if (active) setError(true);
      }
    );
    return () => {
      active = false;
    };
  }, [kind, frontendId, domain, saved, attempt]);

  if (data === null) return null;
  const text = t.contentScript;
  if (!data?.problem) {
    let message = kind === 'review' ? text.loadingNextReview : text.loadingNextRoadmap;
    if (error) message = kind === 'review' ? text.nextReviewFailed : text.nextRoadmapFailed;
    else if (data) message = data.name ? text.noNextRoadmapProblem(data.name) : text.noOtherReviews;
    return (
      <div className="rating-next-status" role={error ? 'alert' : undefined}>
        {message}
        {error && (
          <Button
            className="ml-[5px] border-0 bg-transparent p-0 text-inherit underline [font:inherit]"
            onPress={() => setAttempt((value) => value + 1)}
          >
            {text.retry}
          </Button>
        )}
      </div>
    );
  }
  const problem = data.problem;
  return (
    <a
      className="rating-next-link flex items-center gap-2.5 rounded-md px-[7px] py-[9px] text-(--panel-text) no-underline"
      href={getLeetcodeProblemUrl(problem)}
    >
      <span className="min-w-0 flex-1 wrap-anywhere">
        <span className="mb-1 block text-[11px] text-(--panel-muted)">
          {data.name ? text.nextInRoadmap(data.name) : text.nextReview}
        </span>
        <span className="font-medium">
          {problem.frontendId}. {getProblemTitle(problem, problem.domain)}
        </span>
      </span>
      {problem.isPaidOnly && (
        <FaLock className="shrink-0 text-[12px] text-(--panel-muted)" role="img" aria-label={t.roadmaps.paidOnly} />
      )}
      <FaArrowRight className="shrink-0 text-[12px] text-(--panel-muted)" aria-hidden="true" />
    </a>
  );
}
