// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProblem } from '@/test/utils/card-mocks';
import { getCurrentProblem } from '../problem-data';

const problem = buildProblem();
const question = {
  questionFrontendId: problem.leetcodeId,
  title: problem.name,
  titleSlug: problem.slug,
  difficulty: problem.difficulty,
};

describe('getCurrentProblem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window, 'location', {
      value: { pathname: `/problems/${problem.slug}/`, hostname: 'leetcode.com' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects when no problem slug exists', async () => {
    window.location.pathname = '/home';

    await expect(getCurrentProblem()).rejects.toThrow('Expected a problem slug on the current page');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['leetcode.com', problem.name],
    ['leetcode.cn', '两数之和'],
  ])('fetches and validates a problem on %s', async (domain, name) => {
    window.location.hostname = domain;
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        data: { question: { ...question, translatedTitle: '两数之和', questionId: 'internal-id', extra: true } },
        extensions: { extra: true },
      })
    );

    expect(await getCurrentProblem()).toEqual({ ...problem, domain, name });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`https://${domain}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    });
    const request = vi.mocked(fetch).mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ variables: { titleSlug: problem.slug } });
  });

  it.each([undefined, null, ''])(
    'falls back to the original Chinese-site title when translatedTitle is %j',
    async (translatedTitle) => {
      window.location.hostname = 'leetcode.cn';
      vi.mocked(fetch).mockResolvedValueOnce(Response.json({ data: { question: { ...question, translatedTitle } } }));

      expect(await getCurrentProblem()).toEqual({ ...problem, domain: 'leetcode.cn' });
    }
  );

  it.each([
    ['null root', null],
    ['array root', []],
    ['missing data', {}],
    ['null data', { data: null }],
    ['array data', { data: [] }],
    ['missing question', { data: {} }],
    ['null question', { data: { question: null } }],
    ['array question', { data: { question: [] } }],
    ['GraphQL error', { errors: [{ message: 'Question unavailable' }] }],
  ])('returns null for %s', async (_name, response) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(response));
    expect(await getCurrentProblem()).toBeNull();
  });

  it.each([
    ...['questionFrontendId', 'title', 'titleSlug', 'difficulty'].flatMap((field) =>
      [undefined, null, '', ' ', 42, [], {}].map((value) => ({ field, value }))
    ),
    { field: 'difficulty', value: 'easy' },
    ...[false, 42, [], {}, ' '].map((value) => ({ field: 'translatedTitle', value })),
  ])('returns null for malformed $field: $value', async ({ field, value }) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ data: { question: { ...question, [field]: value } } }));
    expect(await getCurrentProblem()).toBeNull();
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    expect(await getCurrentProblem()).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('invalid json'));
    expect(await getCurrentProblem()).toBeNull();
  });

  it('handles non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await getCurrentProblem()).toBeNull();
  });
});
