// JSON fixtures shared by domain policy and service preparation tests.
export function malformedBackupCases(payload: { data: object }): [string, string][] {
  return [
    ...(['cards', 'stats', 'notes'] as const).map((key): [string, string] => [
      `array-shaped ${key}`,
      JSON.stringify({ ...payload, data: { ...payload.data, [key]: [] } }),
    ]),
    ...[-1, 0.5, '0', null, true].map((schemaVersion): [string, string] => [
      `schema version ${JSON.stringify(schemaVersion)}`,
      JSON.stringify({ ...payload, schemaVersion }),
    ]),
    ...(['exportDate', 'dataUpdatedAt'] as const).flatMap((key) =>
      ['', 'not-a-date', '2024-13-01T00:00:00.000Z', 1704067200000, null, true, {}].map((value): [string, string] => [
        `${key} ${JSON.stringify(value)}`,
        JSON.stringify({ ...payload, [key]: value }),
      ])
    ),
    ...(['settings', 'gistSync'] as const).flatMap((key) =>
      [[], 'invalid', 42, false, null].map((value): [string, string] => [
        `${key} ${JSON.stringify(value)}`,
        JSON.stringify({ ...payload, data: { ...payload.data, [key]: value } }),
      ])
    ),
    ...[{ gistId: 42 }, { gistId: null }, { enabled: 'yes' }, { enabled: null }].map((gistSync): [string, string] => [
      `Gist configuration ${JSON.stringify(gistSync)}`,
      JSON.stringify({ ...payload, data: { ...payload.data, gistSync } }),
    ]),
    ...[{ theme: 'invalid' }, { badgeEnabled: 'yes' }, { autoClearLeetcode: 'yes' }].map(
      (settings): [string, string] => [
        `settings fields ${JSON.stringify(settings)}`,
        JSON.stringify({ ...payload, data: { ...payload.data, settings } }),
      ]
    ),
  ];
}
