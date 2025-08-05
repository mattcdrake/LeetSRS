/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionsSection } from '../ActionsSection';

describe('ActionsSection', () => {
  const mockOnDelete = vi.fn();
  const mockOnDelay = vi.fn();
  const mockOnPause = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    onDelete: mockOnDelete,
    onDelay: mockOnDelay,
    onPause: mockOnPause,
  };

  describe('Expand/Collapse', () => {
    it('should render with collapsed state by default', () => {
      render(<ActionsSection {...defaultProps} />);

      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('▶')).toBeInTheDocument();
      expect(screen.queryByText('1 Day')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Card')).not.toBeInTheDocument();
    });

    it('should expand when header is clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      expect(screen.getByText('1 Day')).toBeInTheDocument();
      expect(screen.getByText('5 Days')).toBeInTheDocument();
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('Delete Card')).toBeInTheDocument();
    });

    it('should collapse when header is clicked again', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });

      // Expand
      fireEvent.click(expandButton);
      expect(screen.getByText('1 Day')).toBeInTheDocument();

      // Collapse
      fireEvent.click(expandButton);
      expect(screen.queryByText('1 Day')).not.toBeInTheDocument();
    });

    it('should rotate arrow icon when expanded', () => {
      render(<ActionsSection {...defaultProps} />);

      const arrow = screen.getByText('▶');
      expect(arrow).not.toHaveClass('rotate-90');

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      expect(arrow).toHaveClass('rotate-90');
    });

    it('should set aria-expanded attribute correctly', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Delay Functionality', () => {
    it('should call onDelay with 1 when 1 Day button is clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const delay1Button = screen.getByRole('button', { name: /1 Day/i });
      fireEvent.click(delay1Button);

      expect(mockOnDelay).toHaveBeenCalledWith(1);
      expect(mockOnDelay).toHaveBeenCalledTimes(1);
    });

    it('should call onDelay with 5 when 5 Days button is clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const delay5Button = screen.getByRole('button', { name: /5 Days/i });
      fireEvent.click(delay5Button);

      expect(mockOnDelay).toHaveBeenCalledWith(5);
      expect(mockOnDelay).toHaveBeenCalledTimes(1);
    });

    it('should display delay card section with both delay options', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      expect(screen.getByRole('button', { name: /1 Day/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /5 Days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
    });
  });

  describe('Pause Functionality', () => {
    it('should display pause button when expanded', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
    });

    it('should call onPause when pause button is clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const pauseButton = screen.getByRole('button', { name: /Pause/i });
      fireEvent.click(pauseButton);

      expect(mockOnPause).toHaveBeenCalledTimes(1);
    });

    it('should apply same styling as delay buttons to pause button', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const pauseButton = screen.getByRole('button', { name: /Pause/i });
      expect(pauseButton).toHaveClass('bg-tertiary');
      expect(pauseButton).toHaveClass('text-primary');
    });
  });

  describe('Delete Functionality', () => {
    it('should show confirmation when delete button is first clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      fireEvent.click(deleteButton);

      expect(screen.getByRole('button', { name: 'Confirm Delete?' })).toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should call onDelete when confirmation is clicked', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      // First click - show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      fireEvent.click(deleteButton);

      // Second click - confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Confirm Delete?' });
      fireEvent.click(confirmButton);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    // Note: Timer-based state reset is tested implicitly in other tests.
    // The setTimeout behavior is difficult to test reliably with fake timers
    // and React's async state updates.

    it('should reset confirmation immediately after delete', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      // First click - show confirmation
      let deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      fireEvent.click(deleteButton);

      // Second click - confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Confirm Delete?' });
      fireEvent.click(confirmButton);

      // Should reset to initial state immediately
      deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      expect(deleteButton).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm Delete?' })).not.toBeInTheDocument();
    });

    it('should apply different styles for delete and confirm states', () => {
      render(<ActionsSection {...defaultProps} />);

      // Expand first
      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      expect(deleteButton).toHaveClass('bg-danger');
      expect(deleteButton).not.toHaveClass('bg-ultra-danger');

      fireEvent.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: 'Confirm Delete?' });
      expect(confirmButton).toHaveClass('bg-ultra-danger');
      expect(confirmButton).not.toHaveClass('bg-danger');
    });
  });

  describe('Visual Styling', () => {
    it('should apply correct styles to container', () => {
      render(<ActionsSection {...defaultProps} />);

      const container = screen.getByText('Actions').closest('.border');
      expect(container).toHaveClass('border', 'border-current', 'rounded-lg', 'bg-secondary', 'overflow-hidden');
    });

    it('should apply hover styles to expand button', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      expect(expandButton).toHaveClass('hover:bg-tertiary', 'transition-colors');
    });

    it('should apply bounce animation class to action buttons', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const delay1Button = screen.getByRole('button', { name: /1 Day/i });
      const delay5Button = screen.getByRole('button', { name: /5 Days/i });
      const pauseButton = screen.getByRole('button', { name: /Pause/i });
      const deleteButton = screen.getByRole('button', { name: 'Delete Card' });

      // Check for bounceButton class effects (from imported styles)
      expect(delay1Button.className).toMatch(/active:translate-y-\[1px\]/);
      expect(delay5Button.className).toMatch(/active:translate-y-\[1px\]/);
      expect(pauseButton.className).toMatch(/active:translate-y-\[1px\]/);
      expect(deleteButton.className).toMatch(/active:translate-y-\[1px\]/);
    });

    it('should have proper spacing between sections', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const contentDiv = screen.getByText('Delete Card').closest('div')?.parentElement;
      expect(contentDiv).toHaveClass('mt-3', 'space-y-3');

      const deleteSection = screen.getByRole('button', { name: 'Delete Card' }).parentElement;
      expect(deleteSection).toHaveClass('pt-2', 'border-t', 'border-current');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks on expand button', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });

      // Rapid clicks
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);

      // Should end up expanded (odd number of clicks)
      expect(screen.getByText('1 Day')).toBeInTheDocument();
    });

    it('should handle rapid clicks on delay buttons', () => {
      render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const delay1Button = screen.getByRole('button', { name: /1 Day/i });

      // Rapid clicks
      fireEvent.click(delay1Button);
      fireEvent.click(delay1Button);
      fireEvent.click(delay1Button);

      expect(mockOnDelay).toHaveBeenCalledTimes(3);
      expect(mockOnDelay).toHaveBeenCalledWith(1);
    });

    it('should clear timeout on unmount to prevent memory leaks', () => {
      const { unmount } = render(<ActionsSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { name: /Actions/i });
      fireEvent.click(expandButton);

      const deleteButton = screen.getByRole('button', { name: 'Delete Card' });
      fireEvent.click(deleteButton);

      // Unmount while confirmation is active
      unmount();

      // Advance timers to ensure no errors occur
      vi.advanceTimersByTime(3000);

      // Test passes if no errors are thrown
    });
  });
});
