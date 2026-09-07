// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
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
