import { useI18n } from '@/entrypoints/popup/contexts/I18nContext';
import { translateApplicationError } from '@/i18n/application-errors';

export function ApplicationErrorMessage({ error }: { error: unknown }) {
  const t = useI18n();
  return error == null ? null : (
    <p role="alert" className="mt-2 text-sm text-danger">
      {translateApplicationError(error, t)}
    </p>
  );
}
