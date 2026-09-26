import { type ReactNode, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { LuLock, LuRotateCcw, LuRoute } from 'react-icons/lu';
import type { NextProblem } from '@/background/next-problems';
import { background } from '@/shared/background-service';
import type { Translations } from '@/shared/i18n';
import type { ProblemReference } from '@/shared/learning-document';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { getProblemTitle } from '@/shared/ui/problem-title';

type Props = { t: Translations; problem: ProblemReference; saved: boolean };
type Recommendation = { name?: string; problem: NextProblem | null };

export function NextProblems({
  action,
  pointerGuard,
  className = '',
  ...props
}: Props & { action?: ReactNode; pointerGuard: boolean; className?: string }) {
  return (
    <div className={`border-t border-line px-1.5 pt-1.5 ${pointerGuard ? 'pointer-guard' : ''} ${className}`}>
      <div className="flex h-6 items-center justify-between pr-1 pl-2 text-[11.5px] font-medium text-fg-3">
        <span>{props.t.contentScript.upNext}</span>
        {action}
      </div>
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
    // Refreshes keep the current rows in place until the new ones arrive.
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
  if (error) {
    return (
      <div className="px-2 py-1 text-[12px] text-fg-3" role="alert">
        {kind === 'review' ? text.nextReviewFailed : text.nextRoadmapFailed}{' '}
        <Button
          className="cursor-pointer rounded-sm font-medium text-fg-2 hover:underline data-focus-visible:outline-2 data-focus-visible:outline-focus data-focus-visible:outline-offset-2"
          onPress={() => setAttempt((value) => value + 1)}
        >
          {text.retry}
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-[47px] items-center gap-2.5 px-2">
        <span className="size-7 shrink-0 rounded-md bg-raised" />
        <span className="grid flex-1 gap-1.5" aria-hidden="true">
          <span className="h-2 w-40 max-w-full rounded-full bg-raised" />
          <span className="h-2 w-20 rounded-full bg-raised" />
        </span>
        <span className="sr-only">{kind === 'review' ? text.loadingNextReview : text.loadingNextRoadmap}</span>
      </div>
    );
  }
  if (!data.problem) {
    return (
      <div className="px-2 py-1 text-[12px] text-fg-3">
        {data.name ? text.noNextRoadmapProblem(data.name) : text.noOtherReviews}
      </div>
    );
  }
  const problem = data.problem;
  const Icon = kind === 'review' ? LuRotateCcw : LuRoute;
  return (
    <a
      className="flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-fg no-underline hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      href={getLeetcodeProblemUrl(problem)}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-raised text-fg-2">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-medium wrap-anywhere">
          <span className="text-fg-3 tabular-nums">{problem.frontendId}.</span>{' '}
          {getProblemTitle(problem, problem.domain)}
        </span>
        <span className="block text-[11.5px] text-fg-3">
          {data.name ? text.nextInRoadmap(data.name) : text.nextReview}
        </span>
      </span>
      {problem.isPaidOnly && (
        <LuLock className="size-3.5 shrink-0 text-fg-3" role="img" aria-label={t.roadmaps.paidOnly} />
      )}
    </a>
  );
}
