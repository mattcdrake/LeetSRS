/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useI18n } from '@/popup/contexts/I18nContext';
import { translations } from '@/shared/i18n/index';
import type { Card } from '@/shared/models';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewCard } from '../ReviewCard';

vi.mock('@/popup/hooks/useTheme', () => ({ useTheme: () => 'light' }));
vi.mock('@/popup/contexts/I18nContext', () => ({ useI18n: vi.fn() }));

describe('ReviewCard', () => {
  const mockOnRate = vi.fn();
  const mockCard: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty' | 'domain'> = {
    slug: 'two-sum',
    leetcodeId: '1',
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

  describe('Rendering', () => {
    it.each(['en', 'pl'] as const)(
      'renders ordered localized ratings and submits each grade once in %s',
      (language) => {
        const t = translations[language];
        vi.mocked(useI18n).mockReturnValue(t);
        renderWithProviders();

        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
          t.ratings[Rating.Again],
          t.ratings[Rating.Hard],
          t.ratings[Rating.Good],
          t.ratings[Rating.Easy],
        ]);
        screen.getAllByRole('button').forEach((button, index) => {
          expect(button).toHaveStyle({ backgroundColor: ['#c73e3e', '#d97706', '#4271c4', '#3d9156'][index] });
          fireEvent.click(button);
          expect(mockOnRate).toHaveBeenCalledTimes(index + 1);
          expect(mockOnRate).toHaveBeenLastCalledWith(index + 1);
        });
      }
    );

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

  describe('Edge Cases', () => {
    it('should handle cards with special characters in slug', () => {
      const specialCard = {
        ...mockCard,
        slug: 'problem-with-special_chars-123',
      };
      renderWithProviders(specialCard);

      const link = screen.getByRole('link', { name: /LeetCode/i });
      expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/problem-with-special_chars-123/description/');
    });
  });
});
