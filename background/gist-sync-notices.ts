import { getDocumentTranslations } from '@/data/translations';
import { type Translations, translations } from '@/i18n';
import { detectBrowserLanguage } from '@/integrations/browser/language';

export async function getSyncNotices() {
  return getDocumentTranslations().then(
    (t) => t.syncNotices,
    () => translations[detectBrowserLanguage()].syncNotices
  );
}

export function presentSyncError(error: unknown, notices: Translations['syncNotices']): string {
  const message = error instanceof Error ? error.message : notices.refreshFailed;
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (/rate limit/i.test(message) || status === 429) return notices.rateLimit;
  if (status === 401 || status === 403 || /401|403|bad credentials/i.test(message)) return notices.authentication;
  if (status === 404 || /404/.test(message)) return notices.gistNotFound;
  if (/fetch|network|offline|timeout/i.test(message) || (typeof status === 'number' && status >= 500)) {
    return notices.unavailable;
  }
  return message;
}
