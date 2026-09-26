import { z } from 'zod';

export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_CALLBACKS: string;
  AUTH_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

const MAX_BODY_BYTES = 4096;
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_TIMEOUT_MS = 15000;
const CHROME_CALLBACK = /^https:\/\/[a-p]{32}\.chromiumapp\.org\/$/;
const FIREFOX_CALLBACK = /^https:\/\/[a-f0-9]{40}\.extensions\.allizom\.org\/$/;

// These field names match GitHub's OAuth API.
const exchangeSchema = z.strictObject({
  code: z.string().min(1).max(256),
  code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  redirect_uri: z.string().url(),
});
const refreshSchema = z.strictObject({ refresh_token: z.string().min(1).max(512) });
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token_expires_in: z.number().positive(),
  token_type: z.literal('bearer'),
  scope: z.string().refine((scope) => scope.split(/[ ,]+/).includes('gist')),
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Every response, including errors, must prevent caching of credentials.
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
    });
    const respond = (status: number, body: unknown) => {
      const content = status === 204 ? null : JSON.stringify(body);
      return new Response(content, { status, headers });
    };

    try {
      const callbacks = getAllowedCallbacks(env.ALLOWED_CALLBACKS);
      if (!callbacks.length || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return respond(503, { error: 'not_configured' });
      }

      // Origin filtering is not authentication; GitHub validates credentials and PKCE.
      // Firefox extension origins use per-install UUIDs, unrelated to the callback ID.
      const origin = request.headers.get('Origin');
      if (origin && !isAllowedOrigin(origin, callbacks)) {
        return respond(403, { error: 'origin_denied' });
      }
      if (origin) headers.set('Access-Control-Allow-Origin', origin);

      const path = new URL(request.url).pathname;
      if (path !== '/exchange' && path !== '/refresh') {
        return respond(404, { error: 'not_found' });
      }
      if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'POST');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return respond(204, null);
      }
      if (request.method !== 'POST') {
        return respond(405, { error: 'method_not_allowed' });
      }

      // CORS is not authentication: a caller can forge Origin. Limit requests
      // before reading credentials, then let GitHub validate the code or token.
      if (!(await isWithinRateLimit(request, env))) {
        return respond(429, { error: 'rate_limited' });
      }
      const contentType = request.headers.get('Content-Type')?.split(';')[0].trim();
      if (contentType !== 'application/json') {
        return respond(415, { error: 'content_type' });
      }
      if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
        return respond(413, { error: 'too_large' });
      }

      let payload: Record<string, string>;
      try {
        payload = await readTokenRequest(request, path);
      } catch {
        return respond(400, { error: 'invalid_request' });
      }
      if (path === '/exchange' && !callbacks.includes(payload.redirect_uri)) {
        return respond(400, { error: 'invalid_callback' });
      }

      const githubResponse = await requestGithubTokens(payload, env);
      if (!githubResponse.ok) {
        return respond(502, { error: 'github_unavailable' });
      }
      const tokens = tokenResponseSchema.safeParse(await githubResponse.json());
      if (!tokens.success) {
        return respond(400, { error: 'authorization_failed' });
      }
      return respond(200, tokens.data);
    } catch {
      // Do not log or return upstream errors: they may contain credentials.
      return respond(502, { error: 'authorization_unavailable' });
    }
  },
};

function getAllowedCallbacks(config: string): string[] {
  return config
    .split(',')
    .map((url) => url.trim())
    .filter((url) => CHROME_CALLBACK.test(url) || FIREFOX_CALLBACK.test(url));
}

function isAllowedOrigin(origin: string, callbacks: string[]): boolean {
  if (origin.startsWith('moz-extension://')) {
    // A fixed Firefox origin cannot be allowlisted across installations. Only enable
    // this transport when Firefox is configured; exchanges still require an exact callback.
    return (
      callbacks.some((callback) => FIREFOX_CALLBACK.test(callback)) &&
      /^moz-extension:\/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(origin)
    );
  }
  return callbacks.some(
    (callback) =>
      CHROME_CALLBACK.test(callback) && origin === `chrome-extension://${new URL(callback).hostname.split('.')[0]}`
  );
}

async function isWithinRateLimit(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;

  const result = await env.AUTH_LIMITER.limit({ key: ip });
  return result.success;
}

async function readTokenRequest(request: Request, path: '/exchange' | '/refresh'): Promise<Record<string, string>> {
  const body = await readLimitedJson(request);
  if (path === '/exchange') {
    return exchangeSchema.parse(body);
  }

  const refresh = refreshSchema.parse(body);
  return { ...refresh, grant_type: 'refresh_token' };
}

async function readLimitedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('Missing body');

  // Count actual bytes as they arrive; Content-Length can be absent or incorrect.
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) throw new Error('Body too large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    await reader.cancel();
  }
}

function requestGithubTokens(payload: Record<string, string>, env: Env): Promise<Response> {
  return fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
    }),
    // Workers support manual redirects; the caller rejects all non-2xx responses.
    redirect: 'manual',
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    cache: 'no-store',
  });
}
