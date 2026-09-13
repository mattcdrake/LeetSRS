/** @vitest-environment happy-dom */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '@/popup/components/Header';
import { useTheme } from '@/popup/hooks/useTheme';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import App from '../App';

vi.mock('@/popup/queries/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/popup/queries/settings')>()),
  useSettingsQuery: () => ({ data: buildSettings() }),
}));
vi.mock('@/popup/hooks/useTheme', () => ({ useTheme: vi.fn() }));
vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('../views/card/CardView', () => ({ CardView: () => null }));
vi.mock('../views/home/HomeView', () => ({
  HomeView: () => (
    <div>
      <Header title="LeetSRS" />
      Saved cards<button type="button">Save note</button>
    </div>
  ),
}));
vi.mock('../views/settings/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('../views/stats/StatsView', () => ({ StatsView: () => null }));

describe('App theme', () => {
  beforeEach(() => {
    vi.mocked(useTheme).mockReturnValue('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
    document.documentElement.style.colorScheme = '';
    document.body.style.colorScheme = '';
  });

  it('applies the resolved theme to the document', () => {
    render(<App />, { wrapper: createTestWrapper().wrapper });

    expect(document.documentElement).toHaveClass('dark');
    expect(document.body).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.body.style.colorScheme).toBe('dark');
    expect(document.documentElement).not.toHaveClass('system');
    expect(document.body).not.toHaveClass('system');
  });
});
