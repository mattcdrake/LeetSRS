import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getCurrentProblem } from '../problem-data';

// @vitest-environment happy-dom

describe('getCurrentProblem', () => {
  beforeEach(() => {
    clearCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when no slug in URL', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/home' },
      writable: true,
    });

    const result = await getCurrentProblem();
    expect(result).toBeNull();
  });

  it('should fetch problem data successfully', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/', hostname: 'leetcode.com' },
      writable: true,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          question: {
            questionId: '1',
            questionFrontendId: '1',
            title: 'Two Sum',
            titleSlug: 'two-sum',
            difficulty: 'Easy',
          },
        },
      }),
    } as Response);

    const result = await getCurrentProblem();
    expect(result).toEqual({
      difficulty: 'Easy',
      name: 'Two Sum',
      slug: 'two-sum',
      leetcodeId: '1',
      domain: 'leetcode.com',
    });
  });

  it('should return cached data for same slug', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/', hostname: 'leetcode.com' },
      writable: true,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          question: {
            questionId: '1',
            questionFrontendId: '1',
            title: 'Two Sum',
            titleSlug: 'two-sum',
            difficulty: 'Easy',
          },
        },
      }),
    } as Response);

    const result1 = await getCurrentProblem();
    const result2 = await getCurrentProblem();

    expect(result1).toEqual(result2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors gracefully', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/', hostname: 'leetcode.com' },
      writable: true,
    });

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await getCurrentProblem();
    expect(result).toBeNull();
  });

  it('should handle non-ok response', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/', hostname: 'leetcode.com' },
      writable: true,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await getCurrentProblem();
    expect(result).toBeNull();
  });
});
