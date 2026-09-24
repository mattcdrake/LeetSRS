/** @vitest-environment happy-dom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/learning-document';
import { writePopupDialogAcknowledgments } from '@/shared/popup-dialogs';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { PopupRoot } from '../PopupRoot';
import { createPopupQueryClient } from '../query-client';

vi.hoisted(() => {
  vi.stubGlobal('__APP_VERSION__', 'test');
});

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.spyOn(fakeBrowser.permissions.onRemoved, 'addListener').mockImplementation(() => {});
  for (const event of [fakeBrowser.permissions.onAdded, fakeBrowser.permissions.onRemoved]) {
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.addCard(buildProblem());
  await writePopupDialogAcknowledgments({ 'release-1.0': true });
});

const openPopup = () => render(<PopupRoot queryClient={createPopupQueryClient()} />);
async function select(label: string, option: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

it('follows OS theme changes, saves explicit preferences, and restores them when reopened', async () => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  const setDark = (matches: boolean) =>
    act(() => {
      Object.defineProperty(media, 'matches', { configurable: true, value: matches });
      media.dispatchEvent(new MediaQueryListEvent('change', { matches }));
    });
  setDark(false);
  const view = openPopup();
  fireEvent.click(await screen.findByLabelText('Settings'));
  await waitFor(() => expect(document.documentElement).toHaveClass('light'));
  setDark(true);
  await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  await select('Theme', 'Light');
  await waitFor(() => expect(document.documentElement).toHaveClass('light'));
  setDark(false);
  setDark(true);
  expect(document.documentElement).toHaveClass('light');
  await select('Theme', 'Dark');
  await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  setDark(false);
  expect(document.documentElement).toHaveClass('dark');
  view.unmount();
  const reopened = openPopup();
  await screen.findByLabelText('Settings');
  await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  fireEvent.click(screen.getByLabelText('Settings'));
  await select('Theme', 'System');
  await waitFor(() => expect(document.documentElement).toHaveClass('light'));
  setDark(true);
  await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  expect((await readLearningDocument()).settings.theme).toBe('system');
  reopened.unmount();
});

it('changes rendered navigation and Settings labels and restores the language on reopen', async () => {
  const view = openPopup();
  fireEvent.click(await screen.findByLabelText('Settings'));
  await select('Display language', '简体中文');
  await screen.findByLabelText('设置');
  expect((await readLearningDocument()).settings.language).toBe('zh-CN');
  view.unmount();
  openPopup();
  await screen.findByLabelText('设置');
  fireEvent.click(await screen.findByLabelText('设置'));
  expect(await screen.findByRole('button', { name: /简体中文/ })).toBeInTheDocument();
});
