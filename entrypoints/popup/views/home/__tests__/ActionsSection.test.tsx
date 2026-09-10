/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionsSection } from '../ActionsSection';

describe('ActionsSection', () => {
  const mockOnDelete = vi.fn();
  const mockOnDelay = vi.fn();
  const mockOnPause = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    onDelete: mockOnDelete,
    onDelay: mockOnDelay,
    onPause: mockOnPause,
    isDisabled: false,
  };

  describe('Expand/Collapse', () => {
    it('expands and collapses the available actions with accessible state', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Delete Card' })).not.toBeInTheDocument();

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Delete Card' })).toBeInTheDocument();

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Delete Card' })).not.toBeInTheDocument();
    });
  });

  describe('Delay Functionality', () => {
    it.each([
      ['1 Day', 1],
      ['5 Days', 5],
    ] as const)('should call onDelay when the %s button for %i days is clicked', (label, days) => {
      render(<ActionsSection {...defaultProps} />);
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);
      fireEvent.click(screen.getByRole('button', { name: label }));

      expect(mockOnDelay).toHaveBeenCalledWith(days);
      expect(mockOnDelay).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pause Functionality', () => {
    it('should call onPause when pause button is clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const pauseButton = screen.getByRole('button', { name: /Pause/i });
      fireEvent.click(pauseButton);

      expect(mockOnPause).toHaveBeenCalledTimes(1);
    });
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

  describe('Edge Cases', () => {
    it('should disable every action while processing', () => {
      const { rerender } = render(<ActionsSection {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Actions/i }));
      rerender(<ActionsSection {...defaultProps} isDisabled />);

      expect(screen.getByRole('button', { name: /Actions/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /1 Day/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /5 Days/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Pause/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete Card' })).toBeDisabled();
    });
  });
});
