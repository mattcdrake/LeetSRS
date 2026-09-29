/** @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { expect, it, vi } from 'vitest';
import * as catalog from '@/shared/catalog';
import { replaceLearningDocument } from '@/shared/learning-document';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery } from '../cards';
import { useNoteQuery } from '../notes';
import { useSettingsQuery } from '../settings';

it('keeps notes and settings available when catalog loading fails', async () => {
  vi.spyOn(catalog, 'getProblemsByFrontendIds').mockRejectedValue(new Error('Catalog unavailable'));
  await replaceLearningDocument(
    buildLearningDocument({
      cards: { 1: createMockCard(State.Review, { note: 'Keep my solution' }) },
      settings: { language: 'zh-CN' },
    })
  );
  const { result } = renderHook(
    () => ({
      cards: useCardsQuery(),
      note: useNoteQuery('1'),
      settings: useSettingsQuery(),
    }),
    { wrapper: createPopupTestWrapper().wrapper }
  );
  await waitFor(() => expect(result.current.cards.error?.message).toBe('Catalog unavailable'));
  expect(result.current.note.data).toBe('Keep my solution');
  expect(result.current.settings.data.language).toBe('zh-CN');
});
