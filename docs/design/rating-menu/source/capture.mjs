import { OUT, start } from './harness.mjs';

const BLIND = ["217","242","1","49","347","271","238","128","125","15","11","121","3","424","76","20","153","33","206","21","141","143","19","23","226","104","100","572","235","102","98","230","105","124","297","295","39","79","208","211","212","200","133","417","207","261","323","269","70","198","213","5","647","91","322","152","139","300","62","1143","53","55","57","56","435","252","253","48","54","73","191","338","190","268","371"];
const only = process.argv.slice(2);
const h = await start();
const log = [];
const T = (d) => (d ? 'dark' : 'light');

async function hidpi(page) {
  const cdp = await page.context().newCDPSession(page);
  const { width, height } = page.viewportSize();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
}
async function panelShot(page, name, pad = 16) {
  const panel = page.locator('.rating-panel');
  const box = await panel.boundingBox();
  const btn = await page.locator('#leetsrs-control').boundingBox();
  const x = Math.max(0, Math.min(box.x, btn.x) - pad);
  const y = Math.max(0, btn.y - pad);
  const vw = page.viewportSize().width;
  const clip = { x, y, width: Math.min(vw - x, Math.max(box.x + box.width, btn.x + btn.width) - x + pad), height: box.y + box.height - y + pad };
  await page.screenshot({ path: `${OUT}${name}.png`, clip });
  log.push(name);
}
async function full(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png`, scale: 'css' });
  log.push(name);
}
async function toolbarShot(page, name) {
  const tb = await page.locator('#ide-top-btns').boundingBox();
  await page.screenshot({ path: `${OUT}${name}.png`, clip: { x: tb.x - 24, y: 0, width: tb.width + 48, height: 96 } });
  log.push(name);
}
const btn = (page) => page.locator('#leetsrs-control').getByRole('button').first();
async function openMenu(page) {
  await btn(page).click();
  await page.locator('.rating-panel').waitFor();
  await page.getByText(/\d+ days?/).first().waitFor();
  await page.waitForTimeout(500);
}
async function run(name, fn) {
  if (only.length && !only.some((o) => name.startsWith(o))) return;
  for (const dark of [false, true]) {
    try {
      await fn(dark);
    } catch (e) {
      console.error(name, T(dark), e.message.split('\n')[0]);
    }
  }
}

const full347 = () => ({
  cards: [...['217', '242', '1', '49'].map((id) => h.card(id)), h.card('20', { dueIn: -1 })],
  roadmap: 'blind-75',
  hint: false,
});
const url347 = 'https://leetcode.com/problems/top-k-frequent-elements/';

// 1. Toolbar button
await run('toolbar', async (dark) => {
  await h.seed({});
  const page = await h.open({ dark });

  await toolbarShot(page, `01-toolbar-rest-${T(dark)}`);
  await btn(page).hover();
  await page.waitForTimeout(150);
  await toolbarShot(page, `01-toolbar-hover-${T(dark)}`);
  const bb = await btn(page).boundingBox();
  await page.mouse.move(bb.x + 10, bb.y + 12, { steps: 4 });
  await page.waitForTimeout(1200);
  await toolbarShot(page, `01-toolbar-hover-tooltip-${T(dark)}`);
  await page.mouse.move(5, 400);
  await page.waitForTimeout(200);
  await page.locator('[data-e2e-locator=console-submit-button]').focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
  await toolbarShot(page, `01-toolbar-focus-${T(dark)}`);
  await page.mouse.move(5, 400);
  const b = await btn(page).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await toolbarShot(page, `01-toolbar-pressed-${T(dark)}`);
  await page.mouse.up();
  await page.close();
});

// 2. Manual open vs auto-open (hint visible), placement at 1280, 1440, 800
await run('open', async (dark) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 800, height: 720 }]) {
    await h.seed({ hint: true });
    const page = await h.open({ dark, viewport });
    await openMenu(page);
    await full(page, `02-open-manual-${viewport.width}-${T(dark)}`);
    await page.close();
  }
  await h.seed({ hint: true });
  const page = await h.open({ dark });
  await h.accept(page);
  await page.locator('.rating-panel').waitFor();
  await page.getByText(/\d+ days?/).first().waitFor();
  await page.waitForTimeout(500);
  await full(page, `02-open-auto-1280-${T(dark)}`);

  await panelShot(page, `02-panel-hint-${T(dark)}`);
  await page.close();
});

// 3. Loading
await run('loading', async (dark) => {
  await h.seed({ ...full347(), fail: { delayGet: 2500 } });
  const page = await h.open({ dark, url: url347 });

  await btn(page).click();
  await page.locator('.rating-panel').waitFor();
  await page.waitForTimeout(400);
  await panelShot(page, `03-loading-intervals-${T(dark)}`);
  await page.getByText(/\d+ days?/).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(200);
  await panelShot(page, `03-loading-next-${T(dark)}`);
  await h.control({});
  await page.close();
});

// 4. Rating rows: hover, focus, press, selected; reduced motion
await run('rows', async (dark) => {
  await h.seed({ ...full347() });
  const page = await h.open({ dark, url: url347 });

  await openMenu(page);
  await panelShot(page, `04-rows-loaded-${T(dark)}`);
  await page.locator('.rating-row').nth(2).hover();
  await page.waitForTimeout(200);
  await panelShot(page, `04-rows-hover-good-${T(dark)}`);
  await page.mouse.move(5, 700);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  await panelShot(page, `04-rows-focus-${T(dark)}`);
  const good = await page.locator('.rating-row').nth(2).boundingBox();
  await page.mouse.move(good.x + 40, good.y + good.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await panelShot(page, `04-rows-mousedown-${T(dark)}`);
  await page.mouse.up();
  await page.waitForTimeout(90);
  await panelShot(page, `04-rows-selected-150ms-${T(dark)}`);
  await page.waitForTimeout(700);
  await panelShot(page, `05-saved-rated-${T(dark)}`);
  await full(page, `05-saved-rated-full-${T(dark)}`);
  await page.close();
});
await run('reduced', async (dark) => {
  await h.seed({ ...full347() });
  const page = await h.open({ dark, url: url347, reducedMotion: true });

  await openMenu(page);
  await page.keyboard.press('2');
  await page.waitForTimeout(120);
  await panelShot(page, `04-rows-selected-reduced-${T(dark)}`);
  await page.close();
});

// 5. Saved without rating, focus after save
await run('unrated', async (dark) => {
  await h.seed({ hint: true });
  const page = await h.open({ dark });

  await openMenu(page);
  await page.keyboard.press('5');
  await page.waitForTimeout(150);
  await panelShot(page, `05-unrated-selected-${T(dark)}`);
  await page.waitForTimeout(900);
  await panelShot(page, `05-saved-unrated-${T(dark)}`);
  const focused = await page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a ? `${a.tagName}.${a.className}` : null;
  });
  console.log('focus after save:', focused);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a ? `${a.tagName} ${a.getAttribute('aria-label')}` : null;
  });
  console.log('focus after escape:', back);
  await page.close();
});

// 6. Next problem variants
await run('next', async (dark) => {
  // finished roadmap + no reviews, no YouTube (LCP on .cn is separate)
  await h.seed({ roadmap: 'blind-75', skips: { 'blind-75': BLIND }, hint: false });
  let page = await h.open({ dark });

  await openMenu(page);
  await panelShot(page, `06-next-finished-${T(dark)}`);
  await page.close();
  // long title review + roadmap
  await h.seed({ cards: [h.card('1430', { dueIn: -2 })], roadmap: 'blind-75', hint: false });
  page = await h.open({ dark });

  await openMenu(page);
  await panelShot(page, `06-next-long-${T(dark)}`);
  await page.keyboard.press('3');
  await page.waitForTimeout(1200);
  await panelShot(page, `06-next-long-saved-${T(dark)}`);
  await page.close();
  // failures: let preview load, then fail next-problem loads
  await h.seed({ ...full347() });
  page = await h.open({ dark, url: url347 });

  await h.control({ delayGet: 800 });
  await btn(page).click();
  await page.waitForTimeout(500);
  await h.control({ failGet: true });
  await page.waitForTimeout(1500);
  await panelShot(page, `06-next-failed-${T(dark)}`);
  await h.control({});
  await page.close();
});

// 7. Existing card states
await run('card', async (dark) => {
  for (const [label, opts] of [
    ['due', { dueIn: -1, scheduled: 12 }],
    ['notdue', { dueIn: 9, scheduled: 12 }],
    ['paused', { dueIn: -1, scheduled: 12, paused: true }],
  ]) {
    await h.seed({ cards: [h.card('1', opts), h.card('20', { dueIn: -1 })], hint: false });
    const page = await h.open({ dark });
    await hidpi(page);
    await openMenu(page);
    await panelShot(page, `07-card-${label}-${T(dark)}`);
    await page.close();
  }
});

// 8. Errors
await run('errors', async (dark) => {
  await h.seed({ ...full347() });
  let page = await h.open({ dark, url: url347 });

  await openMenu(page);
  await h.control({ failSet: true, failGet: true });
  await page.keyboard.press('3');
  await page.waitForTimeout(900);
  await panelShot(page, `08-save-failed-${T(dark)}`);
  await h.control({});
  await page.close();
  await h.seed({ ...full347() });
  page = await h.open({ dark, url: url347 });

  await h.control({ failGet: true });
  await btn(page).click();
  await page.waitForTimeout(1200);
  await panelShot(page, `08-load-failed-${T(dark)}`);
  await h.control({});
  await page.close();
});

// 9. leetcode.cn, nonnumeric id, no YouTube
await run('cn', async (dark) => {
  await h.seed({ cards: [h.card('1430', { dueIn: -2, domain: 'leetcode.cn' })], roadmap: 'blind-75', hint: false });
  const page = await h.open({ dark, url: 'https://leetcode.cn/problems/guess-numbers/', title: 'LCP 01. 猜数字' });

  await openMenu(page);
  await panelShot(page, `09-cn-${T(dark)}`);
  await page.close();
});

// 10. zh-CN
await run('zh', async (dark) => {
  await h.seed({ ...full347(), hint: true, settings: { language: 'zh-CN' } });
  const page = await h.open({ dark, url: url347 });

  await btn(page).click();
  await page.locator('.rating-panel').waitFor();
  await page.getByText(/\d+ 天/).first().waitFor();
  await page.waitForTimeout(600);
  await panelShot(page, `10-zh-${T(dark)}`);
  await page.keyboard.press('3');
  await page.waitForTimeout(1400);
  await panelShot(page, `10-zh-saved-${T(dark)}`);
  await page.close();
});

// 11. Keyboard tab order: focus on hint, next link, YouTube
await run('kbd', async (dark) => {
  await h.seed({ ...full347(), hint: true });
  const page = await h.open({ dark, url: url347 });

  await page.locator('[data-e2e-locator=console-submit-button]').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.locator('.rating-panel').waitFor();
  await page.getByText(/\d+ days?/).first().waitFor();
  await page.waitForTimeout(400);
  const order = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    const f = await page.evaluate(() => {
      let a = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      return a ? `${a.tagName}:${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40)}` : null;
    });
    order.push(f);
    if (i === 5) await panelShot(page, `11-kbd-focus-hint-${T(dark)}`);
    if (i === 6) await panelShot(page, `11-kbd-focus-next-${T(dark)}`);
  }
  console.log('tab order', T(dark), order.join(' → '));
  await page.close();
});

// 12. Toast after editor reset
await run('toast', async (dark) => {
  await h.seed({ cards: [h.card('1', { dueIn: -1 })], settings: { resetEditorOnReviewQueue: true }, hint: false });
  const page = await h.open({ dark });
  await page.getByRole('status').waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
  await full(page, `12-toast-${T(dark)}`);
  await page.close();
});

console.log(log.join('\n'));
await h.close();
