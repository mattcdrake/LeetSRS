import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractProblemData, clearCache } from './problem-data';

// @vitest-environment happy-dom

describe('extractProblemData', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear cache before each test
    clearCache();

    // Suppress console logs
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should return null when no slug in URL', async () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/home' },
      writable: true,
    });

    const result = await extractProblemData();
    expect(result).toBeNull();
  });

  it('should fetch problem data successfully', async () => {
    // Mock window.location with a problem URL
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/' },
      writable: true,
    });

    // Mock successful fetch response
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

    const result = await extractProblemData();
    expect(result).toEqual({
      difficulty: 'Easy',
      title: 'Two Sum',
      titleSlug: 'two-sum',
      questionFrontendId: '1',
    });
  });

  it('should return cached data for same slug', async () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/' },
      writable: true,
    });

    // Mock fetch - should only be called once due to caching
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

    // First call
    const result1 = await extractProblemData();
    // Second call - should use cache
    const result2 = await extractProblemData();

    expect(result1).toEqual(result2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors gracefully', async () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/' },
      writable: true,
    });

    // Mock fetch failure
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await extractProblemData();
    expect(result).toBeNull();
  });

  it('should handle non-ok response', async () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/problems/two-sum/' },
      writable: true,
    });

    // Mock non-ok response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await extractProblemData();
    expect(result).toBeNull();
  });
});
