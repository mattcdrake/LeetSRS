/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { Header } from '../Header';

describe('Header', () => {
  it('renders the provided title', () => {
    render(<Header title="LeetSRS" />, { wrapper: createTestWrapper().wrapper });

    const title = screen.getByRole('heading', { name: 'Leet SRS', level: 1 });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('text-xl', 'font-bold');
  });

  it('renders children when provided', () => {
    render(
      <Header title="Test Title">
        <button type="button">Test Button</button>
      </Header>,
      { wrapper: createTestWrapper().wrapper }
    );

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeInTheDocument();
  });
});
