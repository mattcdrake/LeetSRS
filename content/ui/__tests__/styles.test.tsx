// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { LeetSrsButton } from '../LeetSrsControl';
import { RatingMenu } from '../RatingMenu';
import styles from '../ui.module.css';

it('preserves button backgrounds when the host button reset loads after extension styles', () => {
  const stylesheet = document.createElement('style');
  const css = readFileSync('content/ui/ui.module.css', 'utf8');
  const scopedCss = css.replace(/\.([a-zA-Z]+)/g, (selector, name: string) =>
    styles[name] ? `.${styles[name]}` : selector
  );
  stylesheet.textContent = `${scopedCss}\nbutton, [type='button'] { background-color: transparent; background-image: none; }`;
  document.head.appendChild(stylesheet);
  try {
    render(
      <>
        <LeetSrsButton t={translations.en} onClick={vi.fn()} />
        <RatingMenu t={translations.en} onRate={vi.fn()} onAddWithoutRating={vi.fn()} onSelect={vi.fn()} />
      </>
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveStyle({ backgroundColor: button.style.getPropertyValue('--button-bg') });
    }
  } finally {
    stylesheet.remove();
  }
});

it.each([
  ['light', '#2563eb'],
  ['dark', '#93c5fd'],
])('shows a contrasting focus ring for every rating panel action in %s mode', (theme, color) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const stylesheet = document.createElement('style');
  stylesheet.textContent = readFileSync('content/ui/ui.module.css', 'utf8').replace(
    /\.([a-zA-Z]+)/g,
    (selector, name: string) => (styles[name] ? `.${styles[name]}` : selector)
  );
  stylesheet.textContent += '\nbutton:focus { outline: none; }';
  document.head.appendChild(stylesheet);
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
      expect(button).toHaveStyle({ outlineWidth: '2px', outlineStyle: 'solid', outlineOffset: '2px' });
    }
  } finally {
    stylesheet.remove();
    document.documentElement.classList.remove('dark');
  }
});
