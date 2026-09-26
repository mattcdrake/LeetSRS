// node build.mjs [filter] — renders mock frames over the LeetCode fixture.
import { mkdirSync, writeFileSync } from 'node:fs';
import { compile } from '/home/user/LeetSRS/node_modules/@tailwindcss/node/dist/index.mjs';
import { Scanner } from '/home/user/LeetSRS/node_modules/@tailwindcss/oxide/index.js';
import { chromium } from '/home/user/LeetSRS/node_modules/playwright/index.mjs';
import { fixtureHtml } from '../fixture.mjs';
import { DIRS } from './dirs.mjs';
import { I, S } from './parts.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const FR = `${HERE}frames/`;
const OUT = `${HERE}out/`;
mkdirSync(FR, { recursive: true });
mkdirSync(OUT, { recursive: true });
const filter = process.argv[2];

const TOKENS = `
.ls-light { --ls-surface:#ffffff; --ls-raised:#f4f4f5; --ls-fg:#18181b; --ls-fg-2:#52525b; --ls-fg-3:#71717a;
  --ls-line: rgb(0 0 0 / .08); --ls-line-strong: rgb(0 0 0 / .12); --ls-brand:#267a33; --ls-focus:#267a33;
  --ls-danger:#c42121; --ls-danger-soft: color-mix(in srgb, #dc2626 8%, #fff); --ls-footer: transparent;
  --ls-shadow: 0 0 0 1px rgb(0 0 0 / .08), 0 12px 32px -8px rgb(0 0 0 / .22), 0 4px 10px -4px rgb(0 0 0 / .10);
  --ls-tile-shadow: 0 0 0 1px rgb(0 0 0 / .06), 0 1px 3px rgb(0 0 0 / .1);
  --ls-btn-shadow: 0 0 0 1px rgb(0 0 0 / .1), 0 1px 2px rgb(0 0 0 / .06); }
.ls-dark { --ls-surface:#2a2a2e; --ls-raised:#36363b; --ls-fg:#ededef; --ls-fg-2:#b4b4bc; --ls-fg-3:#94949d;
  --ls-line: rgb(255 255 255 / .08); --ls-line-strong: rgb(255 255 255 / .14); --ls-brand:#5cc466; --ls-focus:#5cc466;
  --ls-danger:#f58a8a; --ls-danger-soft: color-mix(in srgb, #ea5a52 14%, #2a2a2e); --ls-footer: rgb(0 0 0 / .12);
  --ls-shadow: 0 0 0 1px rgb(255 255 255 / .10), 0 16px 40px -8px rgb(0 0 0 / .65), 0 4px 12px -4px rgb(0 0 0 / .45), inset 0 1px 0 rgb(255 255 255 / .05);
  --ls-tile-shadow: 0 0 0 1px rgb(255 255 255 / .08), 0 1px 3px rgb(0 0 0 / .4);
  --ls-btn-shadow: 0 0 0 1px rgb(255 255 255 / .12); }
:root { --host-fill: rgba(0,0,0,.04); --host-fg: #262626; --host-nav: #f0f0f0; }
html.dark { --host-fill: rgba(255,255,255,.1); --host-fg: #eff1f6; --host-nav: #1a1a1a; }
#ls-root, #lsrs-btn { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
#ls-root *, #lsrs-btn * { box-sizing: border-box; }
#ls-root button, #lsrs-btn { border: 0; font: inherit; color: inherit; background: none; padding: 0; cursor: pointer; }
#lsrs-btn { color: var(--ls-brand); }
#ls-root a { color: inherit; text-decoration: none; }
.ring-focus { outline: 2px solid var(--ls-focus); outline-offset: -2px; }
.ring-focus-out { outline: 2px solid var(--ls-focus); outline-offset: 2px; }
.kbd { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 4px;
  background: var(--ls-raised); color: var(--ls-fg-2); font: 500 11px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; }
.ls-panel .kbd { flex-shrink: 0; }
.wordmark { font-family: "JetBrains Mono", ui-monospace, monospace; letter-spacing: -0.01em; }
@font-face { font-family: "JetBrains Mono"; src: url("/home/user/LeetSRS/assets/fonts/jetbrains-mono-wordmark.woff2"); }
`;
const INPUT = `@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@theme {
  --spacing: 4px;
  --color-surface: var(--ls-surface); --color-raised: var(--ls-raised);
  --color-fg: var(--ls-fg); --color-fg-2: var(--ls-fg-2); --color-fg-3: var(--ls-fg-3);
  --color-line: var(--ls-line); --color-brand: var(--ls-brand);
  --color-danger: var(--ls-danger); --color-danger-soft: var(--ls-danger-soft);
}
${TOKENS}`;

// frame: { name, dir, theme, lang, state, opts, viewport, kind: 'panel'|'toolbar'|'toast' }
const frames = [];
const add = (f) => frames.push({ lang: 'en', viewport: { width: 1280, height: 720 }, opts: {}, ...f });
for (const dir of ['A', 'B', 'C']) {
  for (const theme of ['light', 'dark']) {
    add({ name: `${dir}-toolbar-rest-${theme}`, dir, theme, kind: 'toolbar' });
    add({ name: `${dir}-toolbar-focus-${theme}`, dir, theme, kind: 'toolbar', opts: { focus: true } });
    add({ name: `${dir}-open-${theme}`, dir, theme, state: 'open', opts: { hint: true } });
    add({ name: `${dir}-select-${theme}`, dir, theme, state: 'select', opts: { hint: true } });
    add({ name: `${dir}-saved-${theme}`, dir, theme, state: 'saved', opts: {} });
    add({ name: `${dir}-${dir === 'C' ? 'loadfail' : 'loading'}-${theme}`, dir, theme, state: dir === 'C' ? 'loadfail' : 'loading' });
    if (dir === 'B') add({ name: `B-hover-${theme}`, dir, theme, state: 'open', opts: { hover: 3 } });
  }
}
for (const theme of ['light', 'dark']) {
  add({ name: `A-hover-focus-${theme}`, dir: 'A', theme, state: 'open', opts: { hover: 2, focus: 3, due: true } });
  add({ name: `A-loadfail-${theme}`, dir: 'A', theme, state: 'loadfail' });
  add({ name: `A-savefail-${theme}`, dir: 'A', theme, state: 'savefail' });
  add({ name: `A-saved-hover-${theme}`, dir: 'A', theme, state: 'saved', opts: { hoverNext: true, long: true } });
  add({ name: `A-zh-open-${theme}`, dir: 'A', theme, lang: 'zh', state: 'open', opts: { hint: true, hover: 3 } });
  add({ name: `A-zh-saved-${theme}`, dir: 'A', theme, lang: 'zh', state: 'saved' });
  add({ name: `A-narrow-${theme}`, dir: 'A', theme, state: 'open', opts: { hint: true }, viewport: { width: 800, height: 720 } });
  add({ name: `A-toast-${theme}`, dir: 'A', theme, kind: 'toast' });
  add({ name: `A-empty-${theme}`, dir: 'A', theme, state: 'open', opts: { empty: true } });
}

function toast(c) {
  return `<div role="status" class="fixed right-4 bottom-4 flex items-center gap-2.5 rounded-[10px] bg-surface py-2.5 pr-4 pl-3 text-[13px] text-fg shadow-(--ls-shadow)">
    <span class="text-brand">${I.logo('size-4')}</span><span>${c.t.toast}</span></div>`;
}
function tooltip(c) {
  return `<div id="ls-tip" class="absolute flex items-center gap-1.5 rounded-[7px] bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap text-fg shadow-(--ls-shadow)">
    <span class="font-medium">${c.t.tooltip}</span><span class="text-fg-3">${c.t.tooltipSub}</span></div>`;
}

function html(f) {
  const d = DIRS[f.dir];
  const c = { t: S[f.lang], lang: f.lang, theme: f.theme, ...f.opts };
  const button = d.button(c, { focus: f.kind === 'toolbar' && f.opts.focus });
  let overlay = '';
  if (f.kind === 'toolbar' && f.opts.focus) overlay = tooltip(c);
  else if (f.kind === 'toast') overlay = toast(c);
  else if (!f.kind || f.kind === 'panel') overlay = `<div id="ls-pop" class="absolute">${d.panel(c, f.state)}</div>`;
  const page = fixtureHtml({ dark: f.theme === 'dark', title: `${f.lang === 'zh' ? '347. 前 K 个高频元素' : '347. Top K Frequent Elements'}`, extraToolbar: button });
  return page
    .replace('</head>', '<link rel="stylesheet" href="../mock.css"></head>')
    .replace(`<html lang="en" class="`, `<html lang="${f.lang === 'zh' ? 'zh-CN' : 'en'}" class="ls-${f.theme} `)
    .replace(
      '</body>',
      `<div id="ls-root" class="ls-${f.theme}" style="position:fixed;inset:0;pointer-events:none;z-index:10">${overlay}</div>
<script>
  const b = document.getElementById('lsrs-btn').getBoundingClientRect();
  const pop = document.getElementById('ls-pop');
  if (pop) { const w = pop.firstElementChild.offsetWidth; pop.style.top = (b.bottom + 8) + 'px'; pop.style.left = Math.max(16, b.right - w) + 'px'; }
  const tip = document.getElementById('ls-tip');
  if (tip) { tip.style.top = (b.bottom + 8) + 'px'; tip.style.left = (b.left + b.width / 2 - tip.offsetWidth / 2) + 'px'; }
</script></body>`
    );
}

const selected = frames.filter((f) => !filter || f.name.includes(filter));
const pages = frames.map((f) => [f, html(f)]);
const scanner = new Scanner({});
const candidates = scanner.scanFiles(pages.map(([, content]) => ({ content, extension: 'html' })));
const compiler = await compile(INPUT, { base: '/home/user/LeetSRS', onDependency() {} });
writeFileSync(`${HERE}mock.css`, compiler.build(candidates));
for (const [f, content] of pages) writeFileSync(`${FR}${f.name}.html`, content);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const f of selected) {
  await page.setViewportSize(f.viewport);
  await page.goto(`file://${FR}${f.name}.html`);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}${f.name}.png`, scale: 'css' });
  // 2x crop for detail review
  const btn = await page.locator('#lsrs-btn').boundingBox();
  let clip;
  if (f.kind === 'toolbar') {
    const tb = await page.locator('#ide-top-btns').boundingBox();
    clip = { x: tb.x - 20, y: 0, width: tb.width + 190, height: f.opts.focus ? 96 : 60 };
  } else if (f.kind === 'toast') {
    clip = { x: f.viewport.width - 420, y: f.viewport.height - 110, width: 420, height: 110 };
  } else {
    const p = await page.locator('#ls-pop > *').boundingBox();
    const x = Math.max(0, Math.min(p.x, btn.x) - 16);
    clip = { x, y: 0, width: Math.min(f.viewport.width - x, Math.max(p.x + p.width, btn.x + btn.width) + 16 - x), height: p.y + p.height + 16 };
  }
  await page.screenshot({ path: `${OUT}${f.name}@2x.png`, clip });
}
await browser.close();
console.log(`rendered ${selected.length} frames`);
