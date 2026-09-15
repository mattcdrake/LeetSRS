import { registerService } from '@webext-core/proxy-service';
import { vi } from 'vitest';
import { BACKGROUND_SERVICE_KEY, type BackgroundService } from '@/shared/background-service';

export function getRegisteredBackground(): BackgroundService {
  const registration = vi.mocked(registerService).mock.calls.findLast(([key]) => key === BACKGROUND_SERVICE_KEY);
  if (!registration) throw new Error('Background service was not registered synchronously');
  return registration[1] as BackgroundService;
}
