// @vitest-environment happy-dom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { THEME_COLORS } from '../constants';
import { LeetSrsButton } from '../LeetSrsButton';
import { RatingMenu } from '../RatingMenu';
import { Tooltip } from '../Tooltip';

afterEach(() => {
  document.documentElement.className = '';
  document.body.className = '';
});

it.each([
  ['html', 'dark'],
  ['html', 'dark-theme'],
  ['body', 'dark'],
  ['body', 'dark-theme'],
])('updates mounted surfaces when %s toggles %s', async (element, className) => {
  const target = document.createElement('button');
  render(
    <>
      <LeetSrsButton t={translations.en} onClick={vi.fn()} />
      <RatingMenu t={translations.en} onRate={vi.fn()} onAddWithoutRating={vi.fn()} onSelect={vi.fn()} />
      <Tooltip target={target} text="Theme tooltip" delay={0} />
    </>
  );
  const tooltip = await screen.findByRole('tooltip');
  const rating = screen.getByRole('button', { name: translations.en.ratings.again });
  const toolbarBackground = screen.getByRole('button', { name: translations.en.app.name }).parentElement?.parentElement;
  expect(rating).toHaveStyle({ backgroundColor: THEME_COLORS.light.ratingAgain });
  const host = element === 'html' ? document.documentElement : document.body;
  act(() => host.classList.add(className));
  await waitFor(() => {
    expect(rating).toHaveStyle({ backgroundColor: THEME_COLORS.dark.ratingAgain });
    expect(tooltip).toHaveStyle({ backgroundColor: THEME_COLORS.dark.bgTooltip });
    expect(toolbarBackground).toHaveStyle({ backgroundColor: THEME_COLORS.dark.bgTertiary });
  });
  act(() => host.classList.remove(className));
  await waitFor(() => {
    expect(rating).toHaveStyle({ backgroundColor: THEME_COLORS.light.ratingAgain });
    expect(tooltip).toHaveStyle({ backgroundColor: THEME_COLORS.light.bgTooltip });
    expect(toolbarBackground).toHaveStyle({ backgroundColor: THEME_COLORS.light.bgTertiary });
  });
});

it('disconnects theme observers on unmount', () => {
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const { unmount } = render(<LeetSrsButton t={translations.en} onClick={vi.fn()} />);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
