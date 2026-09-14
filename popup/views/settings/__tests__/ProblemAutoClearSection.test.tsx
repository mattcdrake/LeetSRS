/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/integrations/browser/messages';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ProblemAutoClearSection } from '../ProblemAutoClearSection';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('ProblemAutoClearSection', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => messages.reset().resolve('updateSettings', undefined));

  it.each([false, true])('shows and updates the single review-queue reset setting from %s', async (enabled) => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient, { settings: buildSettings({ resetEditorOnReviewQueue: enabled }) });
    render(<ProblemAutoClearSection />, { wrapper });

    const control = screen.getByRole('switch', { name: 'Reset editor when opening from the review queue' });
    expect(control).toHaveAttribute('aria-checked', String(enabled));
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    fireEvent.click(control);

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith('updateSettings', {
        changes: { resetEditorOnReviewQueue: !enabled },
      })
    );
  });
});
