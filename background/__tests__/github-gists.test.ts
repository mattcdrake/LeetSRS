import { afterEach, expect, it, vi } from 'vitest';
import { gistsApi } from '../github-gists';

afterEach(() => vi.restoreAllMocks());

it('sends authorized Gist updates and surfaces GitHub errors with their status', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'gist' }));
  await gistsApi('token').update('gist', { 'leetsrs-backup.json': { content: '{}' } });
  expect(fetch).toHaveBeenCalledWith('https://api.github.com/gists/gist', {
    method: 'PATCH',
    body: JSON.stringify({ files: { 'leetsrs-backup.json': { content: '{}' } } }),
    headers: expect.objectContaining({ Authorization: 'Bearer token' }),
  });

  fetch.mockResolvedValueOnce(Response.json({ message: 'API rate limit exceeded' }, { status: 403 }));
  await expect(gistsApi('token').get('gist')).rejects.toMatchObject({
    message: 'API rate limit exceeded',
    status: 403,
  });
});
