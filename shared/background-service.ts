import { createProxyService, type ProxyServiceKey } from '@webext-core/proxy-service';
import type { createBackgroundService } from '@/background/service';
import type { CatalogProblem } from '@/shared/catalog';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';

export type NextProblem = CatalogProblem & { domain: LeetcodeDomain };
export interface NextRoadmapProblem {
  name: string;
  problem: NextProblem | null;
}

// Derived from the registered commands so RPC names and signatures have one source.
export type BackgroundService = ReturnType<typeof createBackgroundService>;

export const BACKGROUND_SERVICE_KEY = 'background' as ProxyServiceKey<BackgroundService>;
export const background = createProxyService(BACKGROUND_SERVICE_KEY);
