interface Input extends Record<string, unknown> {
  settings?: Record<string, unknown>;
}

export interface RemoveDayStartOutput extends Record<string, unknown> {
  settings?: Record<string, unknown> & { dayStartHour?: never };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInput(data: unknown): asserts data is Input {
  // Reject malformed settings containers; all unrelated records remain untouched.
  if (!isRecord(data) || (data.settings !== undefined && !isRecord(data.settings))) {
    throw new Error('Migration 3 requires a dataset with an optional settings object');
  }
}

function validateOutput(data: RemoveDayStartOutput): void {
  validateInput(data);
  if (data.settings !== undefined && Object.hasOwn(data.settings, 'dayStartHour')) {
    throw new Error('Migration 3 must remove dayStartHour');
  }
}

function transform(data: Input): RemoveDayStartOutput {
  if (data.settings === undefined) return data;
  const { dayStartHour: _retired, ...settings } = data.settings;
  return { ...data, settings };
}

export const removeDayStart = {
  description: 'Remove configurable day start',
  migrate(data: unknown): RemoveDayStartOutput {
    validateInput(data);
    const output = transform(data);
    validateOutput(output);
    return output;
  },
};
