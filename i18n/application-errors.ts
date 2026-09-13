import { type ApplicationErrorCode, getApplicationFailure } from '@/domain/application-error';
import en from './en';

type ErrorTranslations = { applicationErrors?: Partial<Record<ApplicationErrorCode, string>> };

// Missing entries use English; unknown/malformed failures never display arbitrary text.
export function translateApplicationError(error: unknown, t: ErrorTranslations, unexpectedFallback?: string): string {
  const failure = getApplicationFailure(error);
  if (failure.code === 'unexpected' && unexpectedFallback?.trim()) return unexpectedFallback;
  const localized = t.applicationErrors?.[failure.code];
  const template = localized?.trim() ? localized : en.applicationErrors[failure.code];
  if (failure.code === 'note_too_long') return template.replaceAll('{limit}', String(failure.params.limit));
  if (failure.code === 'unsupported_backup_version')
    return template.replaceAll('{version}', String(failure.params.version));
  return template;
}
