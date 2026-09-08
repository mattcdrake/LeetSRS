/** @vitest-environment happy-dom */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '@/entrypoints/popup/hooks/useTheme';
import { buildSettings } from '@/test/utils/settings-mocks';
import { RATING_COLORS } from '@/ui/rating-colors';
import App from '../App';

vi.mock('@/entrypoints/popup/queries/settings', () => ({
  useSettingsQuery: () => ({ data: buildSettings() }),
}));
vi.mock('@/entrypoints/popup/hooks/useTheme', () => ({ useTheme: vi.fn() }));
vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('../views/card/CardView', () => ({ CardView: () => null }));
vi.mock('../views/home/HomeView', () => ({ HomeView: () => null }));
vi.mock('../views/settings/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('../views/stats/StatsView', () => ({ StatsView: () => null }));

describe('App theme', () => {
  beforeEach(() => {
    vi.mocked(useTheme).mockReturnValue('dark');
  });

  afterEach(() => {
    for (const key of Object.keys(RATING_COLORS.light)) {
      document.documentElement.style.removeProperty(`--current-rating-${key}`);
    }
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
    document.documentElement.style.colorScheme = '';
    document.body.style.colorScheme = '';
  });

  it('applies the resolved theme to the document', () => {
    render(<App />);

    expect(document.documentElement).toHaveClass('dark');
    expect(document.body).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.body.style.colorScheme).toBe('dark');
    expect(document.documentElement).not.toHaveClass('system');
    expect(document.body).not.toHaveClass('system');
  });
});
