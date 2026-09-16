import { getCurrentProblemSlug } from './page-context';

export const ACCEPTED_SUBMISSION_MESSAGE = 'leetsrs:accepted-submission';
export interface AcceptedSubmission {
  slug: string;
  submissionId: string;
}

// Runs in the page world so both fetch and XHR responses are observable. Only
// results paired with a new submit request can open the isolated content UI.
export function observeSubmissions(onAccepted: (submission: AcceptedSubmission) => void): () => void {
  const pending = new Map<string, string>();
  let active = true;
  let navigation = 0;
  let currentSlug = getCurrentProblemSlug();
  const onNavigate = () => {
    const slug = getCurrentProblemSlug();
    if (slug !== currentSlug) {
      currentSlug = slug;
      navigation++;
      pending.clear();
    }
  };
  const restoreHistory = (['pushState', 'replaceState'] as const).map((method) => {
    const original = window.history[method];
    const wrapped: typeof original = (data, unused, url) => {
      original.call(window.history, data, unused, url);
      onNavigate();
    };
    window.history[method] = wrapped;
    return () => {
      if (window.history[method] === wrapped) window.history[method] = original;
    };
  });
  window.addEventListener('popstate', onNavigate);
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const requests = new WeakMap<
    XMLHttpRequest,
    { url: string; method: string; slug: string | null; navigation: number }
  >();

  function inspect(rawUrl: string, method: string, slug: string | null, startedNavigation: number, data: unknown) {
    if (
      startedNavigation !== navigation ||
      !active ||
      !slug ||
      slug !== getCurrentProblemSlug() ||
      typeof data !== 'object' ||
      data === null
    )
      return;
    const url = new URL(rawUrl, window.location.href);
    if (url.origin !== window.location.origin) return;
    const submitSlug = url.pathname.match(/^\/problems\/([^/]+)\/submit\/?$/)?.[1];
    if (method.toUpperCase() === 'POST' && submitSlug === slug && 'submission_id' in data) {
      const id = data.submission_id;
      if (typeof id === 'number' || typeof id === 'string') {
        // Bound the tracker even if the page stops polling an abandoned submission.
        if (pending.size >= 100) pending.clear();
        pending.set(String(id), slug);
      }
      return;
    }
    const id = url.pathname.match(/^\/submissions\/detail\/(\d+)\/check\/?$/)?.[1];
    if (!id || pending.get(id) !== slug || !('state' in data) || data.state !== 'SUCCESS') return;
    pending.delete(id);
    if ('status_code' in data && data.status_code === 10) onAccepted({ slug, submissionId: id });
  }

  const fetch: typeof window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const slug = getCurrentProblemSlug();
    const startedNavigation = navigation;
    const response = await originalFetch.call(window, input, init);
    if (/\/(submit|check)\/?(?:\?|$)/.test(url)) {
      void response
        .clone()
        .json()
        .then((data: unknown) => inspect(url, method, slug, startedNavigation, data))
        .catch(() => {});
    }
    return response;
  };
  const open: typeof originalOpen = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    requests.set(this, { url: String(url), method, slug: getCurrentProblemSlug(), navigation });
    originalOpen.call(this, method, url, async, username, password);
  };
  const send: typeof originalSend = function (this: XMLHttpRequest, body) {
    const request = requests.get(this);
    if (request && /\/(submit|check)\/?(?:\?|$)/.test(request.url)) {
      this.addEventListener(
        'load',
        () => {
          try {
            const data: unknown = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
            inspect(request.url, request.method, request.slug, request.navigation, data);
          } catch {
            /* Non-JSON responses leave the host page unaffected. */
          }
        },
        { once: true }
      );
    }
    originalSend.call(this, body);
  };
  window.fetch = fetch;
  XMLHttpRequest.prototype.open = open;
  XMLHttpRequest.prototype.send = send;
  return () => {
    active = false;
    window.removeEventListener('popstate', onNavigate);
    for (const restore of restoreHistory) restore();
    pending.clear();
    if (window.fetch === fetch) window.fetch = originalFetch;
    if (XMLHttpRequest.prototype.open === open) XMLHttpRequest.prototype.open = originalOpen;
    if (XMLHttpRequest.prototype.send === send) XMLHttpRequest.prototype.send = originalSend;
  };
}
