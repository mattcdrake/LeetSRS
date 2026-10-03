export interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

export interface Gist {
  id: string;
  description: string | null;
  updated_at: string;
  owner?: { id: number } | null;
  files: Record<string, GistFile | null>;
}

type GistFiles = Record<string, { content: string }>;

// The few Gist REST endpoints sync uses. Errors carry the HTTP status for syncErrorCode.
export function gistsApi(token: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.github.com/gists${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(body.message ?? `GitHub request failed: ${response.status}`), {
        status: response.status,
      });
    }
    return body;
  }

  return {
    get: (id: string) => request<Gist>(`/${encodeURIComponent(id)}`),
    list: (page: number) => request<Gist[]>(`?per_page=100&page=${page}`),
    create: (gist: { description: string; public: boolean; files: GistFiles }) =>
      request<Gist>('', { method: 'POST', body: JSON.stringify(gist) }),
    update: (id: string, files: GistFiles) =>
      request<Gist>(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ files }) }),
  };
}
