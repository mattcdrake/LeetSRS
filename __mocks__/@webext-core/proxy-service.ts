import { vi } from 'vitest';

const actual = await vi.importActual<typeof import('@webext-core/proxy-service')>('@webext-core/proxy-service');
export const createProxyService = actual.createProxyService;
export const registerService = vi.fn<typeof actual.registerService>();
