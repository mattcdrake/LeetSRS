import { type Mock, vi } from 'vitest';
import type { BackgroundService } from '@/shared/background-service';

export function createMockBackground() {
  return {
    waitForInitialization: vi.fn<BackgroundService['waitForInitialization']>(),
    getProblem: vi.fn<BackgroundService['getProblem']>(),
    addCard: vi.fn<BackgroundService['addCard']>(),
    removeCard: vi.fn<BackgroundService['removeCard']>(),
    delayCard: vi.fn<BackgroundService['delayCard']>(),
    setPauseStatus: vi.fn<BackgroundService['setPauseStatus']>(),
    rateCard: vi.fn<BackgroundService['rateCard']>(),
    saveNote: vi.fn<BackgroundService['saveNote']>(),
    updateSettings: vi.fn<BackgroundService['updateSettings']>(),
    importData: vi.fn<BackgroundService['importData']>(),
    resetAllData: vi.fn<BackgroundService['resetAllData']>(),
    setupGistSync: vi.fn<BackgroundService['setupGistSync']>(),
    setGistSyncEnabled: vi.fn<BackgroundService['setGistSyncEnabled']>(),
    getGistSyncStatus: vi.fn<BackgroundService['getGistSyncStatus']>(),
  } satisfies BackgroundService;
}

type Method = keyof BackgroundService;
type Handler<Name extends Method> = (
  ...args: Parameters<BackgroundService[Name]>
) => ReturnType<BackgroundService[Name]> | Awaited<ReturnType<BackgroundService[Name]>>;

/** Typed service stubs that preserve the browser's JSON serialization boundary. */
export function createServiceMock(background: BackgroundService) {
  const roundTrip = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
  const handle = <Name extends Method>(name: Name, handler: Handler<Name>) => {
    const run = async (...args: Parameters<BackgroundService[Name]>) => roundTrip(await handler(...roundTrip(args)));
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
