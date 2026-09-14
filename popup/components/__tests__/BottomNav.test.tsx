/** @vitest-environment happy-dom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { BottomNav } from '../BottomNav';

describe('BottomNav', () => {
  it('shows the active view and navigates to the selected view', () => {
    const onNavigate = vi.fn();
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient);
    render(<BottomNav activeView="home" onNavigate={onNavigate} />, { wrapper });

    expect(screen.getByRole('radio', { name: 'Home' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Settings' }));

    expect(onNavigate).toHaveBeenCalledWith('settings');
  });

  it('navigates when arrow keys move focus', () => {
    const onNavigate = vi.fn();
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient);
    render(<BottomNav activeView="home" onNavigate={onNavigate} />, { wrapper });
    const home = screen.getByRole('radio', { name: 'Home' });
    const cards = screen.getByRole('radio', { name: 'Cards' });
    home.focus();

    fireEvent.keyDown(home, { key: 'ArrowRight' });

    expect(cards).toHaveFocus();
    expect(onNavigate).toHaveBeenCalledWith('card');
  });
});
