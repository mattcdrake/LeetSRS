import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentProblemSlug } from '../domain';

// @vitest-environment happy-dom

type LeetCodeWindow = Window & {
  next?: {
    router?: {
      query?: {
        slug?: string;
      };
    };
  };
};

const leetCodeWindow = window as LeetCodeWindow;
const originalPath = window.location.pathname;
const originalNext = leetCodeWindow.next;

afterEach(() => {
  history.replaceState({}, '', originalPath);

  if (originalNext === undefined) {
    delete leetCodeWindow.next;
  } else {
    leetCodeWindow.next = originalNext;
  }
});

describe('getCurrentProblemSlug', () => {
  it('returns the router slug when it exists', () => {
    leetCodeWindow.next = { router: { query: { slug: 'router-slug' } } };

    expect(getCurrentProblemSlug()).toBe('router-slug');
  });

  it('prefers the router slug over a different pathname slug', () => {
    history.replaceState({}, '', '/problems/path-slug/');
    leetCodeWindow.next = { router: { query: { slug: 'router-slug' } } };

    expect(getCurrentProblemSlug()).toBe('router-slug');
  });

  it.each([
    ['window.next', undefined],
    ['the router', {}],
    ['the router slug', { router: { query: {} } }],
  ])('falls back to the pathname when %s is absent', (_source, next) => {
    history.replaceState({}, '', '/problems/path-slug/');
    leetCodeWindow.next = next;

    expect(getCurrentProblemSlug()).toBe('path-slug');
  });

  it.each(['/problems/two-sum/', '/problems/two-sum/description/'])('returns only the problem slug from %s', (path) => {
    delete leetCodeWindow.next;
    history.replaceState({}, '', path);

    expect(getCurrentProblemSlug()).toBe('two-sum');
  });

  it('returns null outside a problem pathname', () => {
    delete leetCodeWindow.next;
    history.replaceState({}, '', '/problemset/');

    expect(getCurrentProblemSlug()).toBeNull();
  });
});
