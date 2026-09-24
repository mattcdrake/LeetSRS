import { createProxyService, type ProxyServiceKey } from '@webext-core/proxy-service';
import type { createBackgroundService } from '@/background/service';

// Derived from the registered commands so RPC names and signatures have one source.
export type BackgroundService = ReturnType<typeof createBackgroundService>;

export const BACKGROUND_SERVICE_KEY = 'background' as ProxyServiceKey<BackgroundService>;
export const background = createProxyService(BACKGROUND_SERVICE_KEY);
