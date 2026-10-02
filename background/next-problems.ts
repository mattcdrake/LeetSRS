import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import { type ProblemReference, readLearningDocument } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import { buildReviewQueue } from '@/shared/review';
import {
  getNextRoadmapProblemId,
  loadRoadmap,
  type RoadmapProgressSummary,
  roadmapProblemIds,
  summarizeRoadmap,
} from '@/shared/roadmap';

export type NextProblem = CatalogProblem & { domain: LeetcodeDomain };
interface NextReview {
  problem: NextProblem;
  due: number;
  /** Other due reviews after this one. */
  remaining: number;
}
interface NextRoadmapProblem {
  name: string;
  problem: NextProblem | null;
  progress: RoadmapProgressSummary;
}

export async function getNextReview(current: ProblemReference): Promise<NextReview | null> {
  const document = await readLearningDocument();
  const queue = buildReviewQueue(document, new Date()).filter((card) => card.frontendId !== current.frontendId);
  const next = queue[0];
  if (!next) return null;
  const [problem] = await getProblemsByFrontendIds([next]);
  if (!problem) throw new Error(`Unknown problem: ${next.frontendId} on ${next.domain}`);
  return { problem: { ...problem, domain: next.domain }, due: next.fsrs.due, remaining: queue.length - 1 };
}

export async function getNextRoadmapProblem(current: ProblemReference): Promise<NextRoadmapProblem | null> {
  const document = await readLearningDocument();
  const id = document.activeRoadmapId;
  if (!id) return null;
  const roadmap = await loadRoadmap(id);
  const ids = roadmapProblemIds(roadmap);
  const problems = await getProblemsByFrontendIds(ids.map((frontendId) => ({ frontendId, domain: current.domain })));
  const metadata = Object.fromEntries(ids.map((id, index) => [id, problems[index]]));
  const nextId = getNextRoadmapProblemId(roadmap, document, metadata, current.domain, current.frontendId);
  const problem = nextId ? metadata[nextId] : undefined;
  return {
    name: roadmap.name,
    problem: problem ? { ...problem, domain: current.domain } : null,
    progress: summarizeRoadmap(document, ids, document.roadmapSkips[roadmap.id]),
  };
}
