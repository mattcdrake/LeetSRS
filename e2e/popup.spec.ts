import { State } from 'ts-fsrs';
import { createMockCard } from '../test/utils/card-mocks';
import { expect, importCards, select, test } from './fixtures';

test('preferences follow the OS and survive reopening', async ({ page }) => {
  const theme = page.locator('html');
  await page.getByRole('radio', { name: 'Settings' }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(theme).toHaveClass('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(theme).toHaveClass('dark');
  await select(page, 'Theme', 'Light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(theme).toHaveClass('light');
  await select(page, 'Theme', 'Dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(theme).toHaveClass('dark');
  await page.getByRole('radio', { name: 'Settings' }).click();
  await select(page, 'Theme', 'System');
  await expect(theme).toHaveClass('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(theme).toHaveClass('dark');

  const toggle = page.getByRole('switch', { name: 'Open rating panel after solving' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await page.getByRole('radio', { name: 'Settings' }).click();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await select(page, 'Display language', '简体中文');
  await expect(page.getByRole('radio', { name: '设置' })).toBeVisible();
  await page.reload();
  await page.getByRole('radio', { name: '设置' }).click();
  await expect(page.getByRole('button', { name: /简体中文/ })).toBeVisible();
});

test('roadmap cards can be reviewed, searched, filtered, and reopened with saved notes', async ({ page }) => {
  await page.getByRole('radio', { name: 'Cards' }).click();
  await expect(page.getByText('No cards yet')).toBeVisible();
  await page.getByRole('button', { name: 'Browse roadmaps' }).click();
  await page.getByRole('button', { name: 'Open Blind 75' }).click();
  await page.getByRole('button', { name: /Arrays & Hashing/ }).click();
  await page.getByRole('button', { name: 'Add Two Sum to SRS' }).click();
  await page.getByRole('radio', { name: 'Home' }).click();
  const problem = page.getByRole('link', { name: 'Two Sum', exact: true });
  await expect(problem).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/description/');
  await expect(problem).toHaveAttribute('target', '_blank');
  await expect(problem).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('button', { name: 'Good', exact: true })).toHaveAccessibleDescription(/\d/);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note text' }).fill('Use a map');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Easy', exact: true }).click();
  await expect(page.getByText('All caught up')).toBeVisible();
  await page.reload();
  await expect(page.getByText('All caught up')).toBeVisible();
  await page.getByRole('radio', { name: 'Cards' }).click();
  await page.getByRole('button', { name: /1\. Two Sum/ }).click();
  await expect(page.getByRole('textbox', { name: 'Note text' })).toHaveValue('Use a map');

  const now = Date.now();
  const card = createMockCard(State.New);
  await importCards(page, {
    '1': { ...card, domain: 'leetcode.cn' },
    '2': { ...card, frontendId: '2', fsrs: { ...card.fsrs, due: now } },
    '3': { ...card, frontendId: '3', fsrs: { ...card.fsrs, state: State.Review, due: now + 30 * 86400000 } },
  });
  await page.getByRole('radio', { name: 'Home' }).click();
  await expect(page.getByRole('link', { name: '两数之和', exact: true })).toHaveAttribute(
    'href',
    'https://leetcode.cn/problems/two-sum/description/'
  );
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveAccessibleDescription(/\d/);
  await page.getByRole('button', { name: 'Pause card' }).click();
  await expect(page.getByRole('link', { name: 'Add Two Numbers', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Cards' }).click();
  await expect(page.getByText('3 cards', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Today1', 'Later1', 'Paused1']);
  const row = page.getByRole('button', { name: /1\. 两数之和/ });
  await row.click();
  const search = page.getByRole('textbox', { name: 'Search cards' });
  await search.fill('两数');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  const cn = page.getByRole('link', { name: 'Open 两数之和 on LeetCode' });
  await expect(cn).toHaveAttribute('href', 'https://leetcode.cn/problems/two-sum/description/');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await search.fill('aDd TwO');
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  for (const name of ['Due 2', 'New 2', 'Paused 1']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  await expect(row).toBeVisible();
  await search.fill('missing');
  await expect(page.getByText('No matching cards')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText('3 cards', { exact: true })).toBeVisible();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await search.fill('2');
  await expect(page.getByRole('button', { name: /2\. Add Two Numbers/ })).toBeVisible();
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Due 2', exact: true }).click();
  await page.reload();
  await page.getByRole('radio', { name: 'Cards' }).click();
  await expect(page.getByRole('button', { name: 'Due 2', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(search).toHaveValue('');
  await expect(page.getByText('3 cards', { exact: true })).toBeVisible();
});

test('calendar groups overdue reviews, selects across months, and returns to today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-17T12:00:00'));
  const card = createMockCard(State.Review);
  await importCards(page, {
    '1': { ...card, domain: 'leetcode.cn', fsrs: { ...card.fsrs, due: new Date('2026-09-17T15:00:00').getTime() } },
    '2': { ...card, frontendId: '2', fsrs: { ...card.fsrs, due: new Date('2026-09-16T09:00:00').getTime() } },
    '3': { ...card, frontendId: '3', fsrs: { ...card.fsrs, due: new Date('2026-10-02T09:00:00').getTime() } },
  });
  await page.getByRole('radio', { name: 'Calendar' }).click();
  const day = (date: string) => page.getByRole('button', { name: new RegExp(date) });
  const links = page.getByRole('list').getByRole('link', { name: /^\d+\./ });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAccessibleName('2. Add Two Numbers');
  await expect(links.nth(1)).toHaveAccessibleName('1. 两数之和');
  await expect(links.nth(1)).toHaveAttribute('href', 'https://leetcode.cn/problems/two-sum/description/');
  await expect(day('September 17, 2026')).toHaveAccessibleName(/2 due, 1 overdue$/);
  await expect(day('September 16, 2026')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('listitem').first()).toContainText('Overdue 1d');
  await day('September 18, 2026').click();
  await expect(page.getByText('No problems due on this day.')).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(0);
  await day('October 2, 2026').click();
  await expect(day('October 2, 2026')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('region', { name: 'Friday Oct 2' })).toContainText('1 due');
  await expect(page.getByRole('link', { name: /^3\./ })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/longest-substring-without-repeating-characters/description/'
  );
  await page.getByRole('button', { name: 'Next 4 weeks' }).click();
  await day('October 20, 2026').click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAccessibleName(/^Calendar, September 13\s–\sOctober 10, 2026$/);
  await expect(page.getByRole('region', { name: 'Today Thu, Sep 17' })).toContainText('2 due · 1 overdue');
});
