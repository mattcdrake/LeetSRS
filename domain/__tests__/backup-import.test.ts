import { describe, expect, it } from 'vitest';
import { malformedBackupCases } from '@/test/utils/backup-mocks';
import { normalizeImportData, validateImportStructure } from '../backup-import';

const incomingTime = '2024-01-01T00:00:00.000Z';
const payload = {
  exportDate: incomingTime,
  dataUpdatedAt: incomingTime,
  data: {
    cards: { imported: { id: 'new', unknownField: 'retained' } },
    stats: { arbitrary: { unknownField: 42 } },
    notes: { new: { text: 'new note', unknownField: true } },
    settings: { theme: 'dark' },
    gistSync: { gistId: 'incoming-gist', enabled: false },
  },
};

describe('backup import policy', () => {
  it('retains unknown fields and current-setting precedence over legacy values', () => {
    const prepared = normalizeImportData(
      JSON.parse(
        JSON.stringify({
          ...payload,
          data: {
            ...payload.data,
            settings: {
              resetEditorOnEveryProblem: false,
              autoClearLeetcode: true,
              animationsEnabled: 'ignored',
              unknownSetting: 'retained',
            },
          },
        })
      ),
      0
    );
    expect(prepared).toEqual({
      ...payload.data,
      settings: { resetEditorOnEveryProblem: false, unknownSetting: 'retained' },
      dataUpdatedAt: incomingTime,
    });
  });

  it.each(malformedBackupCases(payload))('rejects malformed envelope: %s', (_name, json) => {
    expect(() => {
      const data = JSON.parse(json);
      validateImportStructure(data);
      normalizeImportData(data, 2);
    }).toThrow();
  });

  it('accepts empty object maps and omitted optional configuration and schema', () => {
    const data = JSON.parse(JSON.stringify({ exportDate: incomingTime, data: { cards: {}, stats: {}, notes: {} } }));
    validateImportStructure(data);
    expect(normalizeImportData(data, 2)).toEqual({
      cards: {},
      stats: {},
      notes: {},
      settings: {},
      gistSync: undefined,
      dataUpdatedAt: undefined,
    });
  });

  it.each([
    ['missing export date', JSON.stringify({ data: {} }), 'Invalid export data structure'],
    [
      'newer schema',
      JSON.stringify({ ...payload, schemaVersion: 3 }),
      'Export is from a newer version (schema 3). Please update the extension.',
    ],
    ...(['cards', 'stats', 'notes'] as const).map((key) => [
      `null ${key}`,
      JSON.stringify({ ...payload, data: { ...payload.data, [key]: null } }),
      `Invalid ${key} data`,
    ]),
    [
      'invalid legacy setting',
      JSON.stringify({
        ...payload,
        data: {
          ...payload.data,
          settings: { autoClearLeetcode: 'yes' },
        },
      }),
      'Reset editor on every problem must be a boolean',
    ],
  ])('preserves the error for %s', (_name, json, message) => {
    expect(() => {
      const data = JSON.parse(json);
      validateImportStructure(data);
      normalizeImportData(data, 2);
    }).toThrow(message);
  });

  it('rejects a null JSON root with a structure error', () => {
    expect(() => validateImportStructure(JSON.parse('null'))).toThrow('Invalid export data structure');
  });
});
