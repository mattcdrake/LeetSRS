/** @vitest-environment happy-dom */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { buildSettings } from '@/test/utils/settings-mocks';
import { PopupRoot } from '../PopupRoot';
import { createPopupQueryClient } from '../query-client';

vi.mock('@/popup/hooks/useTheme', () => ({ useTheme: () => 'light' }));
vi.mock('@/popup/queries/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/popup/queries/settings')>()),
  useSettingsQuery: () => ({ data: buildSettings() }),
}));
vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('../components/StreakCounter', () => ({ StreakCounter: () => null }));
vi.mock('../views/card/CardsView', () => ({ CardsView: () => null }));
vi.mock('../views/home/ReviewQueue', () => ({ ReviewQueue: () => null }));
vi.mock('../views/home/StatsBar', () => ({ StatsBar: () => null }));
vi.mock('../views/settings/SettingsView', () => ({ SettingsView: () => null }));

const contains = vi.fn<() => Promise<boolean>>();
type QueriedTabs = Parameters<Parameters<typeof browser.tabs.query>[1]>[0];
const queryTabs = vi.fn<() => Promise<QueriedTabs>>();

beforeEach(() => {
  browser.permissions.contains = contains;
  browser.tabs.query = queryTabs as typeof browser.tabs.query;
  contains.mockReset();
  contains.mockResolvedValue(false);
  queryTabs.mockReset();
  queryTabs.mockResolvedValue([{ url: 'https://leetcode.cn/problems/two-sum/' } as QueriedTabs[number]]);
  localStorage.clear();
});

function openPopup() {
  return render(<PopupRoot queryClient={createPopupQueryClient()} />);
}

it('reflects external permission changes when the popup reopens without registering listeners', async () => {
  const added = vi.spyOn(browser.permissions.onAdded, 'addListener');
  const removed = vi.spyOn(browser.permissions.onRemoved, 'addListener');

  const initialPopup = openPopup();
  expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
  expect(contains).toHaveBeenCalledTimes(1);
  initialPopup.unmount();

  contains.mockResolvedValue(true);
  const grantedPopup = openPopup();
  await waitFor(() => expect(contains).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
  grantedPopup.unmount();

  contains.mockResolvedValue(false);
  openPopup();
  expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
  expect(contains).toHaveBeenCalledTimes(3);
  expect(added).not.toHaveBeenCalled();
  expect(removed).not.toHaveBeenCalled();
});
