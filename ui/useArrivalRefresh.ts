import { useEffect, useState } from 'react';
import { translations } from '@/i18n';
import { sendMessage } from '@/infrastructure/browser/messages';
import { getDocumentTranslations } from '@/infrastructure/storage/translations';

export interface ArrivalRefreshState {
  pending: boolean;
  notice: string | null;
}

// Disposing a surface only stops rendering/listeners; the background owns the attempt and deadline.
export function watchArrivalRefresh(onChange: (state: ArrivalRefreshState) => void, refreshOnReturn = false) {
  let disposed = false;
  let latestRequest = 0;
  const refresh = async () => {
    const request = ++latestRequest;
    onChange({ pending: true, notice: null });
    try {
      const result = await sendMessage('refreshGistOnArrival');
      if (!disposed && request === latestRequest) {
        onChange({ pending: false, notice: result && !result.success ? result.error : null });
      }
    } catch (error) {
      const t = await getDocumentTranslations().catch(() => translations.en);
      if (!disposed && request === latestRequest) {
        onChange({
          pending: false,
          notice: error instanceof Error ? error.message : t.syncNotices.refreshFailed,
        });
      }
    }
  };
  const onReturn = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  void refresh();
  if (refreshOnReturn) {
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
  }
  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onReturn);
    window.removeEventListener('focus', onReturn);
  };
}

export function useArrivalRefresh() {
  const [state, setState] = useState<ArrivalRefreshState>({ pending: true, notice: null });
  useEffect(() => watchArrivalRefresh(setState), []);
  return state;
}
