import { describe, expect, it } from 'vitest';
import { type ExportData, encodeExportData, parseImportData } from '../backup-codec';

describe('backup codec', () => {
  it('preserves pretty JSON serialization and payload fields', () => {
    const data: ExportData = {
      schemaVersion: 2,
      exportDate: '2026-09-06T12:00:00.000Z',
      data: { cards: {}, stats: {}, notes: {}, settings: {}, gistSync: { enabled: false } },
    };
    expect(encodeExportData(data)).toBe(JSON.stringify(data, null, 2));
    expect(parseImportData(encodeExportData(data))).toEqual(data);
  });

  it('preserves the malformed JSON error', () => {
    expect(() => parseImportData('invalid json')).toThrow('Invalid JSON format');
  });

  it('leaves acceptance of parsed values to import policy', () => {
    expect(parseImportData('null')).toBeNull();
    expect(parseImportData('{}')).toEqual({});
  });
});
