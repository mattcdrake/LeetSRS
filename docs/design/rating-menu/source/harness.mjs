import { launchExtension } from './launch2.mjs';
import { fixtureHtml } from './fixture.mjs';

export const OUT = new URL('./shots/', import.meta.url).pathname;
const DAY = 86_400_000;

export async function start() {
  const ext = await launchExtension();
  const { context } = ext;
  const worker = context.serviceWorkers()[0];
  // Wait for background startup to write the document.
  await ext.page.waitForTimeout(1000);
  const base = await worker.evaluate(async () => (await chrome.storage.local.get('leetsrs:learningDocument'))['leetsrs:learningDocument']);
  let fixture = {};
  await context.route(/:\/\/leetcode\.(com|cn)\/problems\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: fixtureHtml(fixture) })
  );
  await ext.page.close();

  const now = Date.now();
  const card = (frontendId, { state = 2, dueIn = 5, scheduled = 12, paused = false, domain = 'leetcode.com', reps = 3 } = {}) => ({
    frontendId,
    domain,
    createdAt: now - 30 * DAY,
    fsrs: {
      state, due: now + dueIn * DAY, stability: scheduled, difficulty: 5, elapsed_days: 3, scheduled_days: scheduled,
      reps, lapses: 0, last_review: now - 3 * DAY, learning_steps: 0,
    },
    paused,
  });

  async function seed({ cards = [], roadmap = null, skips = {}, settings = {}, hint = true, fail = {} } = {}) {
    const doc = {
      ...base,
      cards: Object.fromEntries(cards.map((c) => [c.frontendId, c])),
      activeRoadmapId: roadmap,
      roadmapSkips: skips,
      settings: { ...base.settings, ...settings },
    };
    await worker.evaluate(
      async ({ doc, hint }) => {
        await chrome.storage.local.set({ 'leetsrs:learningDocument': doc, 'leetsrs:ratingHintShown': !hint });
      },
      { doc, hint }
    );
    await control(fail);
  }

  // Delay or fail background storage access to reach loading and error states.
  async function control({ delayGet = 0, failGet = false, failSet = false } = {}) {
    await worker.evaluate(
      ({ delayGet, failGet, failSet }) => {
        const local = chrome.storage.local;
        self.__orig ??= { get: local.get.bind(local), set: local.set.bind(local) };
        local.get = (...args) =>
          failGet
            ? Promise.reject(new Error('fail'))
            : delayGet
              ? new Promise((r) => setTimeout(() => r(self.__orig.get(...args)), delayGet))
              : self.__orig.get(...args);
        local.set = (...args) => (failSet ? Promise.reject(new Error('fail')) : self.__orig.set(...args));
      },
      { delayGet, failGet, failSet }
    );
  }

  async function open({ url = 'https://leetcode.com/problems/two-sum/', viewport = { width: 1280, height: 720 }, dark = false, title, reducedMotion } = {}) {
    fixture = { dark, title };
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await page.locator('#leetsrs-control').waitFor();
    await page.getByRole('button', { name: 'LeetSRS' }).or(page.getByRole('button', { name: 'LeetSRS', exact: false })).first().waitFor();
    return page;
  }

  async function accept(page, slug = 'two-sum', id = String(Math.floor(Math.random() * 1e9))) {
    await page.evaluate(
      ({ slug, id }) => window.postMessage({ type: 'leetsrs:accepted-submission', slug, submissionId: id }, location.origin),
      { slug, id }
    );
  }

  return { ...ext, worker, seed, control, open, accept, card, now };
}
