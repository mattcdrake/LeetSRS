import { type Mock, vi } from 'vitest';
import type { BackgroundService } from '@/shared/background-service';

type Method = keyof BackgroundService;
type Handler<Name extends Method> = (
  ...args: Parameters<BackgroundService[Name]>
) => ReturnType<BackgroundService[Name]> | Awaited<ReturnType<BackgroundService[Name]>>;

export function createServiceMock(background: BackgroundService) {
  const handle = <Name extends Method>(name: Name, handler: Handler<Name>) => {
    const run = async (...args: Parameters<BackgroundService[Name]>) => await handler(...args);
    (
      vi.mocked(background[name]) as Mock<(...args: Parameters<BackgroundService[Name]>) => Promise<unknown>>
    ).mockImplementation(run);
    return api;
  };
  const resolve = <Name extends Method>(
    name: Name,
    result: ReturnType<BackgroundService[Name]> | Awaited<ReturnType<BackgroundService[Name]>>
  ) => handle(name, () => result);
  const reset = () => {
    for (const name of Object.keys(background) as Method[]) {
      vi.mocked(background[name]).mockReset();
      handle(name, () => {
        throw new Error(`Unexpected background call: ${name}`);
      });
    }
    return api;
  };
  const use = (service: BackgroundService) => {
    for (const name of Object.keys(background) as Method[]) handle(name, service[name] as Handler<typeof name>);
    return api;
  };
  const api = { handle, resolve, reset, use };
  return reset();
}
