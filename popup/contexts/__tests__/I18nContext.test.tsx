/**
 * @vitest-environment happy-dom
 */

import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';
import { I18nProvider, useI18n } from '@/popup/contexts/I18nContext';
import { replaceLearningDocument } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';

it('updates topic labels when the saved application language changes', async () => {
  await replaceLearningDocument(buildLearningDocument({ settings: { language: 'en' } }));
  const { wrapper: QueryProvider } = createPopupTestWrapper();
  const { result } = renderHook(() => useI18n().topicLabel('array'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryProvider>
        <I18nProvider>{children}</I18nProvider>
      </QueryProvider>
    ),
  });
  await waitFor(() => expect(result.current).toBe('Array'));

  await replaceLearningDocument(buildLearningDocument({ settings: { language: 'zh-CN' } }));
  await waitFor(() => expect(result.current).toBe('数组'));
});
