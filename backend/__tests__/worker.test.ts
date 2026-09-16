import { beforeEach, expect, it, vi } from 'vitest';
import worker, { type Env } from '../worker';

const callback = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/';
const token = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 28800,
  refresh_token_expires_in: 15897600,
  token_type: 'bearer',
  scope: 'gist',
};
const env: Env = {
  GITHUB_CLIENT_ID: 'client',
  GITHUB_CLIENT_SECRET: 'secret',
  ALLOWED_CALLBACKS: callback,
  AUTH_LIMITER: { limit: vi.fn() },
};
function request(
  path = '/exchange',
  body: unknown = { code: 'code', code_verifier: 'a'.repeat(43), redirect_uri: callback },
  headers: Record<string, string> = {}
) {
  return new Request(`https://auth.leetsrs.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.mocked(env.AUTH_LIMITER.limit).mockResolvedValue({ success: true });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(token));
});
it.each(['/exchange', '/refresh'])('exchanges %s through the fixed upstream without caching', async (path) => {
  const response = await worker.fetch(
    path === '/refresh' ? request(path, { refresh_token: 'refresh' }) : request(),
    env
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual(token);
  expect(fetch).toHaveBeenCalledWith(
    'https://github.com/login/oauth/access_token',
    expect.objectContaining({ method: 'POST', redirect: 'manual' })
  );
  const options = vi.mocked(fetch).mock.calls[0][1];
  expect(JSON.parse(String(options?.body))).toMatchObject({ client_id: 'client', client_secret: 'secret' });
});
it.each([
  ['callback', { code: 'code', code_verifier: 'a'.repeat(43), redirect_uri: 'https://evil.example/' }],
  ['verifier', { code: 'code', code_verifier: 'short', redirect_uri: callback }],
  ['extra fields', { code: 'code', code_verifier: 'a'.repeat(43), redirect_uri: callback, client_id: 'attacker' }],
])('rejects invalid %s before contacting GitHub', async (_, body) => {
  expect((await worker.fetch(request('/exchange', body), env)).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it('enforces rate limits even without an Origin header', async () => {
  vi.mocked(env.AUTH_LIMITER.limit).mockResolvedValue({ success: false });
  expect((await worker.fetch(request(), env)).status).toBe(429);
  expect(fetch).not.toHaveBeenCalled();
});
it('denies unrecognized origins and permits configured extension preflight', async () => {
  expect((await worker.fetch(request('/exchange', {}, { Origin: 'https://evil.example' }), env)).status).toBe(403);
  const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const response = await worker.fetch(
    new Request('https://auth.leetsrs.com/exchange', { method: 'OPTIONS', headers: { Origin: origin } }),
    env
  );
  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  expect(fetch).not.toHaveBeenCalled();
});
it.each([302, 500, 200])('sanitizes upstream failure %s', async (status) => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: 'secret detail' }, { status }));
  const response = await worker.fetch(request(), env);
  expect(response.ok).toBe(false);
  expect(await response.text()).not.toContain('secret');
});
it('fails closed without configured callbacks or rate limiting', async () => {
  expect((await worker.fetch(request(), { ...env, ALLOWED_CALLBACKS: '' })).status).toBe(503);
  vi.mocked(env.AUTH_LIMITER.limit).mockRejectedValue(new Error('unavailable'));
  expect((await worker.fetch(request(), env)).status).toBe(502);
  expect(fetch).not.toHaveBeenCalled();
});
