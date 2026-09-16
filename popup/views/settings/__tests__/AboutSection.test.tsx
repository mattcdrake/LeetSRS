/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { AboutSection } from '../AboutSection';

vi.hoisted(() => {
  vi.stubGlobal('__APP_VERSION__', '0.6.0');
});

afterAll(() => vi.unstubAllGlobals());

describe('AboutSection', () => {
  it('orders the links as rate, star, Discord, then feedback', () => {
    render(<AboutSection />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Rate LeetSRS',
      'Star on GitHub',
      'Join Discord',
      'Report a bug or suggest a feature',
    ]);
  });

  it.each([
    ['Report a bug or suggest a feature', 'https://github.com/mattcdrake/leetsrs/issues'],
    [
      'Rate LeetSRS',
      'https://chromewebstore.google.com/detail/leetsrs/odgfcigkohoimpeeooifjdglncggkgko/reviews?utm_source=item-share-cb',
    ],
    ['Star on GitHub', 'https://github.com/mattcdrake/leetsrs'],
    ['Join Discord', 'https://discord.gg/fn24NAzBFu'],
  ])('links %s to its destination in a separate tab', (name, href) => {
    render(<AboutSection />);

    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
