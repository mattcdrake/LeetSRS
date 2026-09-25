/**
 * @vitest-environment happy-dom
 */

import { render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { expect, it, vi } from 'vitest';
import { useI18n } from '@/popup/contexts/I18nContext';
import { background } from '@/shared/background-service';
import { translations } from '@/shared/i18n/index';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewCard } from '../ReviewCard';

vi.mock('@/shared/background-service');
vi.mock('@/popup/hooks/useTheme', () => ({ useTheme: () => 'light' }));
vi.mock('@/popup/contexts/I18nContext', () => ({ useI18n: vi.fn() }));

it.each([
  ['leetcode.com', 'Two Sum'],
  ['leetcode.cn', '两数之和'],
] as const)('links the problem on %s in a new tab and shows interval previews', async (domain, title) => {
  vi.mocked(useI18n).mockReturnValue(translations.en);
  createServiceMock(background).reset().resolve('previewRatings', { 1: 1, 2: 45, 3: 150, 4: 548 });
  render(<ReviewCard card={{ ...createMockCardWithProblem(State.New), domain }} onRate={vi.fn()} />, {
    wrapper: createTestWrapper().wrapper,
  });
  expect(screen.getByText('#1')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: title });
  expect(link).toHaveAttribute('href', `https://${domain}/problems/two-sum/description/`);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Easy' })).toHaveAccessibleDescription('1.5y'));
  expect(screen.getByRole('button', { name: 'Good' })).toHaveAccessibleDescription('5mo');
});
