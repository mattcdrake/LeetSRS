// Each concrete step keeps its input/output types. Only the heterogeneous runner
// erases them; it always gives a step's own output to that same step's saver.
export interface Migration<Input = unknown, Output = unknown> {
  description: string;
  // Include every historical value needed by migrate and cleanup.
  load(): Promise<Input>;
  // Pure: validate historical input and output without mutating the input.
  migrate(data: unknown): Output;
  // Saving and cleanup must be repeatable and preserve recovery metadata.
  save(data: Output): Promise<void>;
  cleanup?(input: Input): Promise<void>;
}
