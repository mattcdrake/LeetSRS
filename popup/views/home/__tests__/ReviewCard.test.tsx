/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { expect, it, vi } from 'vitest';
import { useI18n } from '@/popup/contexts/I18nContext';
import { translations } from '@/shared/i18n/index';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { ReviewCard } from '../ReviewCard';

vi.mock('@/popup/hooks/useTheme', () => ({ useTheme: () => 'light' }));
vi.mock('@/popup/contexts/I18nContext', () => ({ useI18n: vi.fn() }));

it.each([
  ['leetcode.com', 'Two Sum'],
  ['leetcode.cn', '两数之和'],
] as const)('links the problem on %s in a new tab', (domain, title) => {
  vi.mocked(useI18n).mockReturnValue(translations.en);
  render(<ReviewCard card={{ ...createMockCardWithProblem(State.New), domain }} onRate={vi.fn()} />);
  expect(screen.getByText('#1')).toBeInTheDocument();
  expect(screen.getByText(title)).toBeInTheDocument();
  const link = screen.getByRole('link', { name: /LeetCode/i });
  expect(link).toHaveAttribute('href', `https://${domain}/problems/two-sum/description/`);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
