/** @vitest-environment happy-dom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cardQueryKeys } from '@/hooks/queries/cards';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { BottomNav } from '../BottomNav';

describe('BottomNav', () => {
  it('shows the active view and navigates to the selected view', () => {
    const onNavigate = vi.fn();
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(cardQueryKeys.reviewQueue, []);
    render(<BottomNav activeView="home" onNavigate={onNavigate} />, { wrapper });

    expect(screen.getByRole('radio', { name: 'Home' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Settings' }));

    expect(onNavigate).toHaveBeenCalledWith('settings');
  });
});
