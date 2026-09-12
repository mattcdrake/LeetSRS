import { type Output as Input, validateOutput as validateInput } from './004-embed-notes';

export type { Input };
export type Output = Input;
export { validateInput };
export const validateOutput: typeof validateInput = validateInput;

// Version 5 changed connection storage only; the learning dataset stayed at v4.
export function convert(data: unknown): Output {
  validateInput(data);
  return data;
}
