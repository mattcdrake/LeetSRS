import type { LeetcodeDomain } from '@/domain/cards';

const EDITOR_RESET_AUTHORIZATION_HASH = '#leetsrs-reset-editor';

type LeetCodeWindow = Window & {
  next?: {
    router?: {
      query?: {
        slug?: string;
      };
    };
  };
};

export function getCurrentDomain(): LeetcodeDomain {
  return window.location.hostname.includes('leetcode.cn') ? 'leetcode.cn' : 'leetcode.com';
}

export function getCurrentProblemSlug(): string | null {
  const routerSlug = (window as LeetCodeWindow).next?.router?.query?.slug;
  return routerSlug || window.location.pathname.match(/\/problems\/([^/]+)/)?.[1] || null;
}

export function authorizeEditorReset(url: string): string {
  return `${url}${EDITOR_RESET_AUTHORIZATION_HASH}`;
}

export function isEditorResetAuthorized(): boolean {
  return window.location.hash === EDITOR_RESET_AUTHORIZATION_HASH;
}
