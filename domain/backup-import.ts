import { type Settings, validateSettings } from './settings';

// Record contents pass through untouched; persistence owns their representation.
interface BackupImportData<Cards, Stats, Notes> {
  schemaVersion?: number;
  exportDate?: string;
  dataUpdatedAt?: string;
  data: {
    cards: Cards;
    stats: Stats;
    notes: Notes;
    settings?: Partial<Settings> & {
      animationsEnabled?: boolean;
      autoClearLeetcode?: boolean;
    };
    gistSync?: { gistId?: string; enabled?: boolean };
  };
}

export function validateImportStructure(data: { exportDate?: unknown; data?: unknown }): void {
  // Validate structure (schemaVersion is optional for backward compat with legacy exports)
  if (!data.exportDate || !data.data) {
    throw new Error('Invalid export data structure');
  }
}

function getImportedSettings(
  settings: BackupImportData<unknown, unknown, unknown>['data']['settings'] | undefined
): Partial<Settings> {
  if (!settings) return {};

  const resetEditorOnEveryProblem = settings.resetEditorOnEveryProblem ?? settings.autoClearLeetcode;
  const { animationsEnabled: _animationsEnabled, autoClearLeetcode: _autoClearLeetcode, ...currentSettings } = settings;
  return {
    ...currentSettings,
    ...(resetEditorOnEveryProblem != null && { resetEditorOnEveryProblem }),
  };
}

export function normalizeImportData<Cards, Stats, Notes>(
  data: BackupImportData<Cards, Stats, Notes>,
  currentSchema: number
) {
  const importedSchema = data.schemaVersion ?? 0; // Legacy exports without schemaVersion = 0

  if (importedSchema > currentSchema) {
    throw new Error(`Export is from a newer version (schema ${importedSchema}). Please update the extension.`);
  }

  if (typeof data.data.cards !== 'object' || data.data.cards === null) {
    throw new Error('Invalid cards data');
  }

  if (typeof data.data.stats !== 'object' || data.data.stats === null) {
    throw new Error('Invalid stats data');
  }

  if (typeof data.data.notes !== 'object' || data.data.notes === null) {
    throw new Error('Invalid notes data');
  }

  const importedSettings = getImportedSettings(data.data.settings);
  validateSettings(importedSettings);

  return {
    cards: data.data.cards,
    stats: data.data.stats,
    notes: data.data.notes,
    settings: importedSettings,
    gistSync: data.data.gistSync,
    dataUpdatedAt: data.dataUpdatedAt,
  };
}
