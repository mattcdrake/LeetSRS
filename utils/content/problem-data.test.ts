import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractProblemData } from './problem-data';

// @vitest-environment happy-dom

describe('extractProblemData', () => {
  let originalGetElementById: typeof document.getElementById;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalGetElementById = document.getElementById;
    // Suppress console logs
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    document.getElementById = originalGetElementById;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should extract problem data from valid __NEXT_DATA__', () => {
    const mockData = {
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              {
                state: {
                  data: {
                    question: {
                      difficulty: 'Medium',
                      title: 'Two Sum',
                      titleSlug: 'two-sum',
                      questionFrontendId: '1',
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };

    document.getElementById = (id: string) => {
      if (id === '__NEXT_DATA__') {
        return {
          textContent: JSON.stringify(mockData),
        } as HTMLElement;
      }
      return null;
    };

    const result = extractProblemData();
    expect(result).toEqual({
      difficulty: 'Medium',
      title: 'Two Sum',
      titleSlug: 'two-sum',
      questionFrontendId: '1',
    });
  });

  it('should return null when __NEXT_DATA__ is not found', () => {
    document.getElementById = () => null;

    const result = extractProblemData();
    expect(result).toBeNull();
  });

  it('should return null when __NEXT_DATA__ has no text content', () => {
    document.getElementById = (id: string) => {
      if (id === '__NEXT_DATA__') {
        return { textContent: '' } as HTMLElement;
      }
      return null;
    };

    const result = extractProblemData();
    expect(result).toBeNull();
  });

  it('should return null when question data is not in expected location', () => {
    const mockData = {
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              {
                state: {
                  data: {
                    // No question property
                  },
                },
              },
            ],
          },
        },
      },
    };

    document.getElementById = (id: string) => {
      if (id === '__NEXT_DATA__') {
        return {
          textContent: JSON.stringify(mockData),
        } as HTMLElement;
      }
      return null;
    };

    const result = extractProblemData();
    expect(result).toBeNull();
  });

  it('should handle malformed JSON gracefully', () => {
    document.getElementById = (id: string) => {
      if (id === '__NEXT_DATA__') {
        return {
          textContent: 'not valid json',
        } as HTMLElement;
      }
      return null;
    };

    const result = extractProblemData();
    expect(result).toBeNull();
  });

  it('should handle multiple queries and find the one with question data', () => {
    const mockData = {
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              { state: { data: {} } },
              {
                state: {
                  data: {
                    question: {
                      difficulty: 'Hard',
                      title: 'Median of Two Sorted Arrays',
                      titleSlug: 'median-of-two-sorted-arrays',
                      questionFrontendId: '4',
                    },
                  },
                },
              },
              { state: { data: {} } },
            ],
          },
        },
      },
    };

    document.getElementById = (id: string) => {
      if (id === '__NEXT_DATA__') {
        return {
          textContent: JSON.stringify(mockData),
        } as HTMLElement;
      }
      return null;
    };

    const result = extractProblemData();
    expect(result).toEqual({
      difficulty: 'Hard',
      title: 'Median of Two Sorted Arrays',
      titleSlug: 'median-of-two-sorted-arrays',
      questionFrontendId: '4',
    });
  });
});
