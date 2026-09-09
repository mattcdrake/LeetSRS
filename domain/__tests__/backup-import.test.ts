import { describe, expect, it } from 'vitest';
import { normalizeImportData } from '../backup-import';

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
});
