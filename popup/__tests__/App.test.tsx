/** @vitest-environment happy-dom */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/integrations/browser/messages';
import { Header } from '@/popup/components/Header';
import { useTheme } from '@/popup/hooks/useTheme';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import App from '../App';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

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
    vi.mocked(sendMessage).mockResolvedValue(undefined);
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

it('refreshes on opening, keeps saved data visible, and releases edits with the background result', async () => {
  const refresh = Promise.withResolvers<undefined>();
  vi.mocked(sendMessage).mockReturnValue(refresh.promise);
  render(<App />, { wrapper: createTestWrapper().wrapper });
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('refreshGistOnArrival'));
  expect(screen.getByText('Saved cards')).toBeVisible();
  expect(screen.getByRole('status', { name: 'Syncing...' }).parentElement?.previousElementSibling).toHaveTextContent(
    'LeetSRS'
  );
  expect(screen.queryByText('Syncing...')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save note' })).toBeEnabled();
  await act(async () => refresh.resolve(undefined));
  expect(screen.getByRole('button', { name: 'Save note' })).toBeEnabled();
});
