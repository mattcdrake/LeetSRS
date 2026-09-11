// Each concrete step keeps its input/output types. Only the heterogeneous runner
// erases them; it always gives a step's own output to that same step's saver.
export interface Migration<Input = unknown, Output = unknown> {
  description: string;
  validateOutput(data: unknown): void;
  load(): Promise<Input>;
  migrate(data: unknown): Output;
  save(data: Output): Promise<void>;
  cleanup?(input: Input): Promise<void>;
}
