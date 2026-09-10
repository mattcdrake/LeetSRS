export interface Migration {
  description: string;
  // Return JSON-serializable data containing every input needed to repeat migrate and cleanup.
  load: () => Promise<unknown>;
  // Check historical input and output here; startup and imports always use this transformation.
  migrate: (data: unknown) => unknown;
  save: (data: unknown) => Promise<void>;
  cleanup?: (input: unknown) => Promise<void>;
}
