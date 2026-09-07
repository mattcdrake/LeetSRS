// @vitest-environment happy-dom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { RatingMenu } from '../RatingMenu';

it.each([
  ['light', '#2563eb'],
  ['dark', '#93c5fd'],
])('provides contrasting focus colors and focused state for every rating panel action in %s mode', (theme, color) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    const { container } = render(
      <RatingMenu t={translations.en} onRate={vi.fn()} onAddWithoutRating={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstElementChild).toHaveStyle({ '--focus-ring': color });
    // Mouse-opened panels should also make their focused choice visible.
    fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
    for (const button of screen.getAllByRole('button')) {
      act(() => button.focus());
      expect(button).toHaveAttribute('data-focused', 'true');
    }
  } finally {
    document.documentElement.classList.remove('dark');
  }
});
