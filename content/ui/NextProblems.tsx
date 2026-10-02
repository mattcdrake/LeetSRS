import { type ReactNode, useEffect, useState } from 'react';
import { Button, ProgressBar } from 'react-aria-components';
import { LuChevronRight, LuLock, LuRotateCcw, LuRoute } from 'react-icons/lu';
import { background } from '@/shared/background-service';
import { formatDue } from '@/shared/due';
import type { Translations } from '@/shared/i18n';
import type { ProblemReference } from '@/shared/learning-document';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { RoadmapProgressSummary } from '@/shared/roadmap';
import { getProblemTitle } from '@/shared/ui/problem-title';

type Props = { t: Translations; problem: ProblemReference; saved: boolean };
type Recommendation =
  | { kind: 'review'; review: Awaited<ReturnType<typeof background.getNextReview>> }
  | { kind: 'roadmap'; roadmap: Awaited<ReturnType<typeof background.getNextRoadmapProblem>> };

export function NextProblems({
  action,
  pointerGuard,
  className = '',
  ...props
}: Props & { action?: ReactNode; pointerGuard: boolean; className?: string }) {
  return (
    <div className={`border-t border-line px-1.5 pt-1.5 ${pointerGuard ? 'pointer-guard' : ''} ${className}`}>
      <div className="flex h-6 items-center justify-between pr-1 pl-2 text-panel-meta font-medium text-fg-3">
        <span>{props.t.contentScript.upNext}</span>
        {action}
      </div>
      <NextProblemRow {...props} kind="review" />
      <NextProblemRow {...props} kind="roadmap" />
    </div>
  );
}

function NextProblemRow({ t, problem: { frontendId, domain }, saved, kind }: Props & { kind: 'review' | 'roadmap' }) {
  const [data, setData] = useState<Recommendation>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Saving and retrying refresh the recommendation.
  useEffect(() => {
    let active = true;
    // Refreshes keep the current rows in place until the new ones arrive.
    setError(false);
    const current = { frontendId, domain };
    const request: Promise<Recommendation> =
      kind === 'review'
        ? background.getNextReview(current).then((review) => ({ kind, review }))
        : background.getNextRoadmapProblem(current).then((roadmap) => ({ kind, roadmap }));
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

  const text = t.contentScript;
  if (error) {
    return (
      <div className="px-2 py-1 text-panel-meta text-fg-3" role="alert">
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
  // No active roadmap.
  if (data.kind === 'roadmap' && !data.roadmap) return null;
  const row =
    data.kind === 'review'
      ? data.review && {
          problem: data.review.problem,
          tile: 'bg-info-soft text-info',
          Icon: LuRotateCcw,
          meta: (
            <>
              <span className="shrink-0">{text.review}</span>
              <Separator />
              <span className="truncate tabular-nums">{formatDue(data.review.due, Date.now(), t).label}</span>
              {data.review.remaining > 0 && (
                <>
                  <Separator />
                  <span className="shrink-0 tabular-nums">{text.moreDue(data.review.remaining)}</span>
                </>
              )}
            </>
          ),
        }
      : data.roadmap?.problem && {
          problem: data.roadmap.problem,
          tile: 'bg-brand-soft text-brand',
          Icon: LuRoute,
          meta: <RoadmapMeta t={t} name={data.roadmap.name} progress={data.roadmap.progress} />,
        };
  if (!row) {
    return (
      <div className="px-2 py-1 text-panel-meta text-fg-3">
        {data.kind === 'roadmap' && data.roadmap ? text.noNextRoadmapProblem(data.roadmap.name) : text.noOtherReviews}
      </div>
    );
  }
  const { problem, tile, Icon, meta } = row;
  return (
    <a
      className="group flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-fg no-underline hover:bg-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      href={getLeetcodeProblemUrl(problem)}
    >
      <span className={`grid size-7 shrink-0 place-items-center rounded-md ${tile}`}>
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-panel-body font-medium wrap-anywhere">
          <span className="text-fg-3 tabular-nums">{problem.frontendId}.</span>{' '}
          {getProblemTitle(problem, problem.domain)}
        </span>
        <span className="flex items-center gap-1 text-panel-meta text-fg-3">{meta}</span>
      </span>
      {problem.isPaidOnly && (
        <LuLock className="size-3.5 shrink-0 text-fg-3" role="img" aria-label={t.roadmaps.paidOnly} />
      )}
      <LuChevronRight
        className="size-3.5 shrink-0 text-fg-3 opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
    </a>
  );
}

function RoadmapMeta({ t, name, progress }: { t: Translations; name: string; progress: RoadmapProgressSummary }) {
  return (
    <>
      <span className="truncate">{name}</span>
      <Separator />
      <ProgressBar
        aria-label={name}
        value={progress.reviewed}
        maxValue={progress.total}
        valueLabel={t.roadmaps.reviewed(progress.reviewed, progress.total)}
        className="h-1 w-9 shrink-0 overflow-hidden rounded-full bg-raised-2"
      >
        <div className="h-full bg-brand" style={{ width: `${(progress.reviewed / progress.total) * 100}%` }} />
      </ProgressBar>
      <span className="shrink-0 tabular-nums" aria-hidden="true">
        {t.contentScript.roadmapProgress(progress.reviewed, progress.total)}
      </span>
    </>
  );
}

function Separator() {
  return (
    <span className="shrink-0" aria-hidden="true">
      ·
    </span>
  );
}
