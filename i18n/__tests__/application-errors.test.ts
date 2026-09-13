import { describe, expect, it } from 'vitest';
import { ApplicationError, type ApplicationFailure } from '@/domain/application-error';
import { translations } from '@/i18n';
import { translateApplicationError } from '../application-errors';

const failures: ApplicationFailure[] = [
  { code: 'unexpected' },
  { code: 'invalid_input' },
  { code: 'invalid_settings' },
  { code: 'card_not_found' },
  { code: 'invalid_backup' },
  { code: 'gist_token_required' },
  { code: 'gist_id_required' },
  { code: 'gist_not_found' },
  { code: 'gist_backup_missing' },
  { code: 'github_unauthorized' },
  { code: 'github_forbidden' },
  { code: 'github_rate_limited' },
  { code: 'github_unavailable' },
  { code: 'note_too_long', params: { limit: 500 } },
  { code: 'unsupported_backup_version', params: { version: 7 } },
];

describe.each(Object.entries(translations))('%s application errors', (language, t) => {
  it('translates every code and interpolates only validated parameters', () => {
    expect(Object.keys(t.applicationErrors).sort()).toEqual(failures.map(({ code }) => code).sort());
    for (const failure of failures) {
      const message = translateApplicationError(new ApplicationError(failure), t);
      expect(message.trim()).not.toBe('');
      expect(message).not.toMatch(/\{(?:limit|version)\}/);
      if (language !== 'en') expect(message).not.toBe(translateApplicationError(failure, translations.en));
    }
    expect(translateApplicationError(failures[13], t)).toContain('500');
    expect(translateApplicationError(failures[14], t)).toContain('7');
  });

  it('uses the localized generic fallback for unknown, malformed and legacy errors', () => {
    for (const error of [
      new Error('secret remote response'),
      'raw server text',
      null,
      { code: 'future_error', params: { token: 'secret' } },
      { code: '__proto__' },
      { code: 'note_too_long', params: { limit: 'secret' } },
    ]) {
      expect(translateApplicationError(error, t)).toBe(t.applicationErrors.unexpected);
    }
  });

  it('falls back to English for a missing or empty localized entry', () => {
    for (const missing of [undefined, '']) {
      expect(
        translateApplicationError(
          { code: 'gist_not_found' },
          {
            applicationErrors: { ...t.applicationErrors, gist_not_found: missing },
          }
        )
      ).toBe(translations.en.applicationErrors.gist_not_found);
    }
    expect(translateApplicationError({ code: 'unknown' }, {})).toBe(translations.en.applicationErrors.unexpected);
  });
});
