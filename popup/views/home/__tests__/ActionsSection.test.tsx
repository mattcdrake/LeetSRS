/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionsSection } from '../ActionsSection';

describe('ActionsSection', () => {
  const mockOnDelete = vi.fn();
  const mockOnDelay = vi.fn();
  const mockOnPause = vi.fn();

  const defaultProps = {
    onDelete: mockOnDelete,
    onDelay: mockOnDelay,
    onPause: mockOnPause,
    isDisabled: false,
  };

  it.each([
    ['1 Day', 1],
    ['5 Days', 5],
  ])('postpones the card with %s', (name, days) => {
    const onDelay = vi.fn();
    render(<ActionsSection {...defaultProps} onDelay={onDelay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name }));
    expect(onDelay).toHaveBeenCalledExactlyOnceWith(days);
  });

  it('pauses the card from the pause row', () => {
    const onPause = vi.fn();
    render(<ActionsSection {...defaultProps} onPause={onPause} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause card' }));
    expect(onPause).toHaveBeenCalledOnce();
  });

  describe('Delete Functionality', () => {
    it('deletes only after confirmation and resets the confirmation afterward', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      // First click - show confirmation
      let deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      fireEvent.click(deleteButton);
      expect(mockOnDelete).not.toHaveBeenCalled();

      // Second click - confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Confirm Delete?' });
      fireEvent.click(confirmButton);
      expect(mockOnDelete).toHaveBeenCalledTimes(1);

      // Should reset to initial state immediately
      deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      expect(deleteButton).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm Delete?' })).not.toBeInTheDocument();
    });
  });
});
