import { type Settings, validateSettings } from './settings';

interface BackupImportEnvelope {
  schemaVersion?: unknown;
  exportDate: unknown;
  dataUpdatedAt?: unknown;
  data: Record<string, unknown>;
}

function isObjectMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateImportStructure(data: unknown): asserts data is BackupImportEnvelope {
  if (!isObjectMap(data) || !data.exportDate || !isObjectMap(data.data)) {
    throw new Error('Invalid export data structure');
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function getImportedSettings(settings: unknown): Partial<Settings> {
  if (settings === undefined) return {};
  if (!isObjectMap(settings)) throw new Error('Invalid settings data');

  const resetEditorOnEveryProblem =
    settings.resetEditorOnEveryProblem !== undefined ? settings.resetEditorOnEveryProblem : settings.autoClearLeetcode;
  const { animationsEnabled: _animationsEnabled, autoClearLeetcode: _autoClearLeetcode, ...currentSettings } = settings;
  const importedSettings = {
    ...currentSettings,
    ...(resetEditorOnEveryProblem !== undefined && { resetEditorOnEveryProblem }),
  };
  // Validate known settings while retaining unrelated fields for compatibility.
  validateSettings(importedSettings as Partial<Settings>);
  return importedSettings as Partial<Settings>;
}

function getImportedGistSync(value: unknown): { gistId?: string; enabled?: boolean } | undefined {
  if (value === undefined) return undefined;
  if (
    !isObjectMap(value) ||
    (value.gistId !== undefined && typeof value.gistId !== 'string') ||
    (value.enabled !== undefined && typeof value.enabled !== 'boolean')
  ) {
    throw new Error('Invalid Gist sync configuration');
  }
  return value;
}

export function normalizeImportData(data: BackupImportEnvelope, currentSchema: number) {
  if (
    data.schemaVersion !== undefined &&
    (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion) || data.schemaVersion < 0)
  ) {
    throw new Error('Invalid schema version');
  }
  const importedSchema = data.schemaVersion ?? 0;
  if (importedSchema > currentSchema) {
    throw new Error(`Export is from a newer version (schema ${importedSchema}). Please update the extension.`);
  }
  if (!isTimestamp(data.exportDate)) throw new Error('Invalid export timestamp');
  if (data.dataUpdatedAt !== undefined && !isTimestamp(data.dataUpdatedAt)) {
    throw new Error('Invalid update timestamp');
  }

  if (!isObjectMap(data.data.cards)) throw new Error('Invalid cards data');
  if (!isObjectMap(data.data.stats)) throw new Error('Invalid stats data');
  if (!isObjectMap(data.data.notes)) throw new Error('Invalid notes data');

  return {
    cards: data.data.cards,
    stats: data.data.stats,
    notes: data.data.notes,
    settings: getImportedSettings(data.data.settings),
    gistSync: getImportedGistSync(data.data.gistSync),
    dataUpdatedAt: data.dataUpdatedAt,
  };
}
