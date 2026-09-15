/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useI18n } from '@/popup/contexts/I18nContext';
import { translations } from '@/shared/i18n/index';
import type { CardWithProblem } from '@/shared/models';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewCard } from '../ReviewCard';

vi.mock('@/popup/hooks/useTheme', () => ({ useTheme: () => 'light' }));
vi.mock('@/popup/contexts/I18nContext', () => ({ useI18n: vi.fn() }));

describe('ReviewCard', () => {
  const mockOnRate = vi.fn();
  const mockCard: Pick<CardWithProblem, 'slug' | 'frontendId' | 'name' | 'difficulty' | 'domain'> = {
    slug: 'two-sum',
    frontendId: '1',
    name: 'Two Sum',
    difficulty: 'Easy',
    domain: 'leetcode.com',
  };

  const renderWithProviders = (card = mockCard, onRate = mockOnRate, resetEditorOnReviewQueue = false) => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient, { settings: buildSettings({ resetEditorOnReviewQueue }) });
    return render(<ReviewCard card={card} onRate={onRate} />, { wrapper });
  };

  beforeEach(() => {
    vi.mocked(useI18n).mockReturnValue(translations.en);
  });

  describe('review-queue reset authorization', () => {
    it('renders the problem identity and an unauthorized external link when reset is disabled', () => {
      renderWithProviders();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /LeetCode/i });
      expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/description/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it.each(['leetcode.com', 'leetcode.cn'] as const)('authorizes a queue opening on %s', (domain) => {
      renderWithProviders({ ...mockCard, domain }, mockOnRate, true);
      expect(screen.getByRole('link', { name: /LeetCode/i })).toHaveAttribute(
        'href',
        `https://${domain}/problems/two-sum/description/#leetsrs-reset-editor`
      );
    });
  });
});
