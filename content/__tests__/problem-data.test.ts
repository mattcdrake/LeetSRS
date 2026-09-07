import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProblem } from '../problem-data';

// @vitest-environment happy-dom

describe('getCurrentProblem', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects when no problem slug exists', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/home' },
      writable: true,
    });

    await expect(getCurrentProblem()).rejects.toThrow('Expected a problem slug on the current page');
    expect(global.fetch).not.toHaveBeenCalled();
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
