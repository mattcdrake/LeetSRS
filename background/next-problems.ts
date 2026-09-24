import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import { type ProblemReference, readLearningDocument } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import { buildReviewQueue } from '@/shared/review';
import { getNextRoadmapProblemId, loadRoadmap, roadmapProblemIds } from '@/shared/roadmap';

export type NextProblem = CatalogProblem & { domain: LeetcodeDomain };
interface NextRoadmapProblem {
  name: string;
  problem: NextProblem | null;
}

export async function getNextReview(current: ProblemReference): Promise<NextProblem | null> {
  const document = await readLearningDocument();
  const next = buildReviewQueue(document, new Date()).find((card) => card.frontendId !== current.frontendId);
  if (!next) return null;
  const [problem] = await getProblemsByFrontendIds([next]);
  if (!problem) throw new Error(`Unknown problem: ${next.frontendId} on ${next.domain}`);
  return { ...problem, domain: next.domain };
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
  return { name: roadmap.name, problem: problem ? { ...problem, domain: current.domain } : null };
}
