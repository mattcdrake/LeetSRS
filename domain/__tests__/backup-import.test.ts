import { describe, expect, it } from 'vitest';
import { malformedBackupCases, mixedRecordBackup } from '@/test/utils/backup-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { normalizeImportData, validateImportRelationships, validateImportStructure } from '../backup-import';

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
  it('accepts valid relationships', () => {
    expect(() => validateImportRelationships(mixedRecordBackup().accepted)).not.toThrow();
  });

  it.each(['slug', 'duplicate', 'date', 'orphan'] as const)('rejects an invalid %s relationship', (kind) => {
    const { accepted } = mixedRecordBackup();
    const records = {
      cards: { ...accepted.cards },
      stats: { ...accepted.stats },
      notes: { ...accepted.notes },
    };
    if (kind === 'slug') records.cards['two-sum'].slug = 'different';
    if (kind === 'duplicate') records.cards['cn-problem'].id = records.cards['two-sum'].id;
    if (kind === 'date') records.stats['2024-01-01'].date = '2024-01-02';
    if (kind === 'orphan') delete (records.cards as Record<string, unknown>)['two-sum'];
    expect(() => validateImportRelationships(records)).toThrow(
      {
        slug: 'Card slug does not match key: two-sum',
        duplicate: 'Duplicate card ID: valid-com',
        date: 'Stats date does not match key: 2024-01-01',
        orphan: 'Note has no owning card: valid-com',
      }[kind]
    );
  });

  it('drops extra configuration fields and gives current settings precedence over legacy values', () => {
    const prepared = normalizeImportData(
      JSON.parse(
        JSON.stringify({
          ...payload,
          extra: true,
          data: {
            ...payload.data,
            extra: true,
            gistSync: { ...payload.data.gistSync, extra: { nested: true }, githubPat: 'ignored' },
            settings: {
              resetEditorOnEveryProblem: false,
              autoClearLeetcode: true,
              animationsEnabled: 'ignored',
              unknownSetting: { nested: true },
            },
          },
        })
      ),
      0
    );
    expect(prepared).toEqual({
      ...payload.data,
      schemaVersion: 0,
      settings: { resetEditorOnEveryProblem: false },
      dataUpdatedAt: incomingTime,
    });
  });

  it('retains every supported setting while discarding extra settings', () => {
    const settings = buildSettings({
      maxNewCardsPerDay: 7,
      dayStartHour: 4,
      theme: 'dark',
      resetEditorOnEveryProblem: true,
      resetEditorOnDueReview: true,
      badgeEnabled: false,
      language: 'zh-CN',
    });
    expect(
      normalizeImportData(
        { ...payload, data: { ...payload.data, settings: { ...settings, extra: { nested: true } } } },
        2
      ).settings
    ).toEqual(settings);
  });

  it.each(['toString', 'constructor', '__proto__'])('rejects imported prototype language %s', (language) => {
    expect(() => normalizeImportData({ ...payload, data: { ...payload.data, settings: { language } } }, 2)).toThrow(
      `Unsupported language: ${language}. Supported languages: de, en, hi, pl, zh-CN`
    );
  });

  it('omits undefined settings and inherited settings on import', () => {
    const settings = Object.assign(Object.create({ badgeEnabled: false }), { theme: undefined, dayStartHour: 5 });
    expect(normalizeImportData({ ...payload, data: { ...payload.data, settings } }, 2).settings).toEqual({
      dayStartHour: 5,
    });
  });

  it.each([true, false])('maps legacy autoClearLeetcode %s to the current setting', (value) => {
    expect(
      normalizeImportData({ ...payload, data: { ...payload.data, settings: { autoClearLeetcode: value } } }, 2).settings
    ).toEqual({ resetEditorOnEveryProblem: value });
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
      schemaVersion: 0,
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
