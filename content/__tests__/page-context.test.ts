import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentProblemSlug } from '@/content/page-context';

// @vitest-environment happy-dom

const originalPath = window.location.pathname;
afterEach(() => {
  history.replaceState({}, '', originalPath);
});

describe('getCurrentProblemSlug', () => {
  it.each(['/problems/two-sum/', '/problems/two-sum/description/'])('returns only the problem slug from %s', (path) => {
    history.replaceState({}, '', path);

    expect(getCurrentProblemSlug()).toBe('two-sum');
  });

  it('returns null outside a problem pathname', () => {
    history.replaceState({}, '', '/problemset/');

    expect(getCurrentProblemSlug()).toBeNull();
  });
});
