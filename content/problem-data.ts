import { getCurrentDomain, getCurrentProblemSlug } from '@/content/page-context';
import { sendMessage } from '@/shared/messages';
import { type ProblemDescriptor, problemDescriptorSchema } from '@/shared/models';

export async function getCurrentProblem(): Promise<ProblemDescriptor> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  return problemDescriptorSchema.parse(await sendMessage('getProblem', { slug, domain: getCurrentDomain() }));
}
