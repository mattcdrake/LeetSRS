import { DATA, I, RATING } from './parts.mjs';

const mix = (color, pct, base = 'var(--ls-surface)') => `color-mix(in srgb, ${color} ${pct}%, ${base})`;
const G = [1, 2, 3, 4];

// ---------- Direction A: Quiet list (popup parity) ----------
function aHeader(c, { loading } = {}) {
  const { t, lang } = c;
  const title = lang === 'zh' ? DATA.problem.zh : DATA.problem.title;
  return `<div class="px-3.5 pt-3 pb-2">
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1 text-[14px] font-semibold tracking-[-0.01em] text-fg">${t.how}</div>
      <span class="wordmark shrink-0 text-[11px] text-fg-3">Leet<span class="text-brand">SRS</span></span>
    </div>
    <div class="mt-0.5 flex h-5 items-center gap-2">
      ${
        loading
          ? '<div class="h-2 w-36 rounded-full bg-raised"></div>'
          : `<div class="min-w-0 flex-1 truncate text-[12px] text-fg-3"><span class="tabular-nums">${DATA.problem.id}.</span> ${title}${c.due ? ` · <span class="font-medium text-fg-2">${t.dueToday}</span>` : ''}</div>
      <a class="-mr-1.5 grid size-6 shrink-0 place-items-center rounded-md text-fg-3 ${c.focusYt ? 'ring-focus' : ''}" title="Watch NeetCode solution on YouTube">${I.yt('size-4')}</a>`
      }
    </div>
  </div>`;
}

function aRow(c, g, { hover, focus, selected, dim, loading, interval } = {}) {
  const { t, theme } = c;
  const color = RATING[theme][g];
  const bg = selected ? mix(color, 14) : hover ? mix(color, 9) : 'transparent';
  const ring = selected ? `box-shadow: inset 0 0 0 1px ${mix(color, 55, 'transparent')};` : '';
  return `<div class="flex h-9 items-center gap-2.5 rounded-lg px-2.5 ${focus ? 'ring-focus' : ''} ${dim ? 'opacity-45' : ''}" style="background:${bg};${ring}">
    <span class="grid w-3 shrink-0 place-items-center"><span class="size-2 rounded-full" style="background:${color};${selected ? `box-shadow:0 0 0 3px ${mix(color, 28, 'transparent')}` : ''}"></span></span>
    <span class="w-11 shrink-0 font-medium ${loading ? 'text-fg-2' : 'text-fg'}">${t.ratings[g]}</span>
    <span class="min-w-0 flex-1 truncate text-[12px] ${hover || selected ? 'text-fg-2' : 'text-fg-3'}">${t.desc[g]}</span>
    ${
      loading
        ? '<span class="h-2 w-9 rounded-full bg-raised"></span>'
        : `<span class="shrink-0 text-[12px] tabular-nums ${selected ? 'text-fg font-medium' : 'text-fg-2'}">${interval ?? t.days(DATA.intervals[g])}</span>`
    }
    <kbd class="kbd">${g}</kbd>
  </div>`;
}

function aWithout(c, { dim, hover } = {}) {
  return `<div class="mx-1.5 flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-fg-2 ${dim ? 'opacity-45' : ''} ${hover ? 'bg-raised' : ''}">
    <span class="grid w-3 shrink-0 place-items-center">${I.plus('size-3.5')}</span>
    <span class="flex-1">${c.t.without}</span><kbd class="kbd">5</kbd></div>`;
}

function aNextRow(c, kind, { hover } = {}) {
  const { t } = c;
  const item = kind === 'review' ? DATA.review : DATA.roadmap;
  const long = c.long && kind === 'review';
  const title = long ? 'Check If a String Is a Valid Sequence from Root to Leaves Path in a Binary Tree' : item.title;
  return `<a class="flex items-center gap-2.5 rounded-lg px-2 py-[7px] ${hover ? 'bg-raised' : ''}">
    <span class="grid size-7 shrink-0 place-items-center rounded-md bg-raised text-fg-2">${kind === 'review' ? I.review('size-3.5') : I.route('size-3.5')}</span>
    <span class="min-w-0 flex-1">
      <span class="${long ? 'line-clamp-2' : 'block truncate'} text-[13px] font-medium text-fg"><span class="tabular-nums text-fg-3">${long ? '1430' : item.id}.</span> ${title}</span>
      <span class="block text-[11.5px] text-fg-3">${kind === 'review' ? t.nextReview : t.nextIn(DATA.roadmap.name)}</span>
    </span>
    ${item.paid || long ? `<span class="text-fg-3" title="Premium">${I.lock('size-3.5')}</span>` : ''}
  </a>`;
}

function aUpNext(c, { yt, loading, empty } = {}) {
  const { t } = c;
  const label = `<div class="flex h-6 items-center justify-between pr-1 pl-2 text-[11.5px] font-medium text-fg-3"><span>${t.upNext}</span>
    ${yt ? `<a class="flex items-center gap-1 rounded-md px-1 font-normal text-fg-3" title="Watch NeetCode solution on YouTube">${I.yt('size-3.5')}</a>` : ''}</div>`;
  const skeleton = `<div class="flex items-center gap-2.5 px-2 py-[7px]"><span class="size-7 shrink-0 rounded-md bg-raised"></span>
    <span class="grid flex-1 gap-1.5"><span class="h-2 w-40 rounded-full bg-raised"></span><span class="h-2 w-20 rounded-full bg-raised"></span></span></div>`;
  const body = loading
    ? skeleton + skeleton
    : empty
      ? `<div class="grid gap-1 px-2 pt-0.5 pb-1.5 text-[12px] text-fg-3"><span>${t.noReviews}</span><span>${t.noRoadmap(DATA.roadmap.name)}</span></div>`
      : aNextRow(c, 'review', { hover: c.hoverNext }) + aNextRow(c, 'roadmap');
  return `<div class="mt-1.5 border-t border-line px-1.5 pt-1.5">${label}${body}</div>`;
}

function aFooterHint(c) {
  return `<div class="mt-1.5 flex h-10 items-center gap-1.5 border-t border-line px-3.5 text-[12px] text-fg-3">
    <span class="truncate">${c.t.hint}</span>
    <button class="shrink-0 rounded font-medium text-fg-2 ${c.focusHint ? 'ring-focus-out' : ''}">${c.t.off}</button>
  </div>`;
}

function aBanner(c, text, retry) {
  return `<div role="alert" class="mx-1.5 mb-1 flex items-start gap-2 rounded-lg bg-danger-soft px-2.5 py-2 text-[12px] leading-[1.4] text-danger">
    ${I.alert('size-3.5 mt-px shrink-0')}<span class="flex-1">${text}</span>
    ${retry ? `<button class="-my-0.5 shrink-0 rounded-md bg-surface px-2 py-0.5 font-medium text-fg shadow-(--ls-btn-shadow)">${c.t.retry}</button>` : ''}
  </div>`;
}

function panelA(c, state) {
  const { t, theme } = c;
  const wrap = (inner) => `<div class="ls-panel w-[300px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[12px] bg-surface pb-1.5 text-[13px] leading-[1.35] text-fg shadow-(--ls-shadow)">${inner}</div>`;
  if (state === 'saved') {
    const g = 3;
    const color = RATING[theme][g];
    return wrap(`
      <div role="status" class="flex items-center gap-3 px-3.5 pt-3.5 pb-3">
        <span class="grid size-7 shrink-0 place-items-center rounded-full" style="background:${mix(color, 16)};color:${color}">${I.check('size-3.5')}</span>
        <div class="min-w-0 flex-1"><div class="text-[14px] font-semibold tracking-[-0.01em]">${t.savedAs(t.ratings[g])}</div>
        <div class="truncate text-[12px] text-fg-3">${t.reviewIn(DATA.intervals[g])} · ${t.date}</div></div>
        <div class="-mr-1.5 flex shrink-0 flex-col items-end gap-0.5">
          <button class="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-fg-2">${I.undo('size-3.5')}${t.undo}</button>
        </div>
      </div>
      <div class="-mt-1.5">${aUpNext(c, { yt: true, empty: c.empty })}</div>`);
  }
  if (state === 'loading') {
    return wrap(`${aHeader(c, { loading: true })}<div class="grid gap-px px-1.5">${G.map((g) => aRow(c, g, { loading: true })).join('')}</div>
      <div class="my-1.5 h-px bg-line"></div>${aWithout(c, { dim: true })}${aUpNext(c, { loading: true })}`);
  }
  if (state === 'loadfail') {
    return wrap(`${aHeader(c, { loading: true })}${aBanner(c, t.loadFailed, true)}<div class="grid gap-px px-1.5 opacity-60">${G.map((g) => aRow(c, g, { loading: true })).join('')}</div>`);
  }
  const selecting = state === 'select';
  return wrap(`${aHeader(c)}
    ${state === 'savefail' ? aBanner(c, t.saveFailed, false) : ''}
    <div class="grid gap-px px-1.5">${G.map((g) =>
      aRow(c, g, {
        hover: !selecting && c.hover === g,
        focus: !selecting && c.focus === g,
        selected: selecting && g === 3,
        dim: selecting && g !== 3,
        interval: c.inPrefix ? t.inDays(DATA.intervals[g]) : undefined,
      })
    ).join('')}</div>
    <div class="my-1.5 h-px bg-line"></div>
    ${aWithout(c, { dim: selecting })}
    ${aUpNext(c, { empty: c.empty })}
    ${c.hint ? aFooterHint(c) : ''}`);
}

function buttonA(c, { focus } = {}) {
  return `<button id="lsrs-btn" class="tb-lsrs ml-1 grid size-8 place-items-center rounded-[6px] text-brand ${focus ? 'ring-focus-out' : ''}" style="background:var(--host-fill)">${I.logo('size-4')}</button>`;
}

// ---------- Direction B: Scale ----------
function panelB(c, state) {
  const { t, theme, lang } = c;
  const title = lang === 'zh' ? DATA.problem.zh : DATA.problem.title;
  const wrap = (inner) => `<div class="ls-panel w-[300px] overflow-hidden rounded-[14px] bg-surface text-[13px] leading-[1.35] text-fg shadow-(--ls-shadow)">${inner}</div>`;
  const header = `<div class="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
      <div class="min-w-0 flex-1"><div class="text-[14px] font-semibold tracking-[-0.01em]">${t.how}</div>
      <div class="truncate text-[12px] text-fg-3"><span class="tabular-nums">${DATA.problem.id}.</span> ${title}</div></div>
      <a class="-mr-1 grid size-7 place-items-center rounded-md text-fg-3">${I.yt('size-4')}</a></div>`;
  if (state === 'saved') {
    const color = RATING[theme][3];
    const next = (kind) => {
      const it = kind === 'review' ? DATA.review : DATA.roadmap;
      return `<a class="flex h-9 items-center gap-2.5 rounded-lg px-2 ${kind === 'review' && c.hoverNext ? 'bg-raised' : ''}">
        <span class="text-fg-3">${kind === 'review' ? I.review('size-3.5') : I.route('size-3.5')}</span>
        <span class="min-w-0 flex-1 truncate font-medium"><span class="tabular-nums text-fg-3">${it.id}.</span> ${it.title}</span>
        ${it.paid ? `<span class="text-fg-3">${I.lock('size-3')}</span>` : ''}
        <span class="shrink-0 text-[11.5px] text-fg-3">${kind === 'review' ? t.nextReview : DATA.roadmap.name}</span></a>`;
    };
    return wrap(`<div role="status" class="m-2 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2" style="background:${mix(color, 12)}">
        <span style="color:${color}">${I.check('size-4')}</span>
        <span class="min-w-0 flex-1"><span class="font-semibold">${t.saved} · ${t.ratings[3]}</span> <span class="text-fg-2">${t.inDays(3)}</span></span>
        <button class="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-fg-2">${t.undo}</button></div>
      <div class="px-1.5 pb-1.5">${next('review')}${next('roadmap')}</div>`);
  }
  const loading = state === 'loading';
  const sel = state === 'select' ? 3 : null;
  const active = sel ?? c.hover;
  const tile = (g) => {
    const color = RATING[theme][g];
    const on = g === active && !loading;
    const style = sel === g
      ? `background:${mix(color, 18)};box-shadow:inset 0 0 0 1px ${mix(color, 60, 'transparent')}`
      : on
        ? 'background:var(--ls-surface);box-shadow:var(--ls-tile-shadow)'
        : '';
    const d = DATA.intervals[g];
    return `<div class="relative flex h-[60px] flex-col justify-between overflow-hidden rounded-[8px] px-2 pt-1.5 pb-1.5 ${sel && sel !== g ? 'opacity-45' : ''}" style="${style}">
      <span class="flex items-center gap-1.5 text-[12px] font-semibold"><span class="size-1.5 rounded-full" style="background:${color}"></span>${t.ratings[g]}</span>
      ${loading ? '<span class="mb-1 h-2.5 w-8 rounded-full bg-(--ls-line-strong)"></span>' : `<span class="text-[16px] font-semibold tabular-nums tracking-[-0.02em]">${lang === 'zh' ? `${d}<span class="ml-0.5 text-[11px] font-medium text-fg-3">天</span>` : `${d}<span class="ml-0.5 text-[11px] font-medium text-fg-3">${d === 1 ? 'day' : 'days'}</span>`}</span>`}
      <span class="kbd absolute right-1.5 bottom-1.5 !h-4 !min-w-4 !text-[10px] !bg-transparent">${g}</span>
      ${on && !sel ? `<span class="absolute inset-x-2 bottom-0 h-[2px] rounded-full" style="background:${color}"></span>` : ''}
    </div>`;
  };
  const caption = active && !loading
    ? `<span class="font-medium text-fg-2">${t.ratings[active]}</span> · ${t.desc[active]} · ${t.inDays(DATA.intervals[active])}`
    : loading ? '&nbsp;' : t.caption;
  return wrap(`${header}
    ${state === 'loadfail' ? aBanner(c, t.loadFailed, true) : ''}
    <div class="mx-2.5 grid grid-cols-4 gap-1 rounded-[11px] bg-raised p-1">${G.map(tile).join('')}</div>
    <div class="truncate px-3.5 pt-2 text-[12px] text-fg-3">${caption}</div>
    <div class="flex items-center justify-between px-2 pt-1 pb-2">
      <button class="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-fg-2 ${sel ? 'opacity-45' : ''}">${I.plus('size-3.5')}${t.without}<kbd class="kbd ml-0.5">5</kbd></button>
    </div>
    ${c.hint ? `<div class="flex h-9 items-center gap-1.5 border-t border-line px-3.5 text-[11.5px] text-fg-3"><span class="truncate">${t.hint}</span><button class="font-medium text-fg-2">${t.off}</button></div>` : ''}`);
}

function buttonB(c, { focus } = {}) {
  return `<button id="lsrs-btn" class="relative ml-1 grid size-8 place-items-center rounded-[6px] text-(--host-fg) ${focus ? 'ring-focus-out' : ''}" style="background:var(--host-fill)">${I.logo('size-4')}
    <span class="absolute top-[5px] right-[5px] size-[7px] rounded-full bg-brand ring-2 ring-(--host-nav)"></span></button>`;
}

// ---------- Direction C: Palette ----------
function panelC(c, state) {
  const { t, theme, lang } = c;
  const title = lang === 'zh' ? DATA.problem.zh : DATA.problem.title;
  const wrap = (inner) => `<div class="ls-panel w-[300px] overflow-hidden rounded-[12px] bg-surface text-[13px] leading-[1.35] text-fg shadow-(--ls-shadow)">${inner}</div>`;
  const header = `<div class="flex h-11 items-center gap-2 border-b border-line px-3">
    <span class="text-brand">${I.logo('size-4')}</span>
    <span class="min-w-0 flex-1 truncate font-medium"><span class="tabular-nums text-fg-3">${DATA.problem.id}.</span> ${title}</span>
    </div>`;
  const label = (s) => `<div class="px-3 pt-2 pb-1 text-[11px] font-medium text-fg-3">${s}</div>`;
  const item = (g, { active, sel, dim } = {}) => {
    const color = RATING[theme][g];
    return `<div class="mx-1.5 flex h-8 items-center gap-2.5 rounded-md px-1.5 ${active ? 'bg-raised' : ''} ${dim ? 'opacity-45' : ''}" style="${sel ? `background:${mix(color, 16)}` : ''}">
      <span class="grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[11px] font-semibold tabular-nums" style="background:${mix(color, 16)};color:${color}">${g}</span>
      <span class="shrink-0 font-medium">${t.ratings[g]}</span>
      <span class="min-w-0 flex-1 truncate text-[12px] text-fg-3">${t.desc[g]}</span>
      ${state === 'loading' ? '<span class="h-2 w-8 rounded-full bg-raised"></span>' : `<span class="text-[12px] tabular-nums text-fg-2">${t.days(DATA.intervals[g])}</span>`}
      ${active ? `<span class="text-fg-3">${I.enter('size-3.5')}</span>` : ''}
    </div>`;
  };
  const nextItem = (kind, active) => {
    const it = kind === 'review' ? DATA.review : DATA.roadmap;
    return `<div class="mx-1.5 flex h-8 items-center gap-2.5 rounded-md px-1.5 ${active ? 'bg-raised' : ''}">
      <span class="grid size-[18px] shrink-0 place-items-center text-fg-3">${kind === 'review' ? I.review('size-3.5') : I.route('size-3.5')}</span>
      <span class="min-w-0 flex-1 truncate"><span class="tabular-nums text-fg-3">${it.id}.</span> ${it.title}</span>
      ${it.paid ? `<span class="text-fg-3">${I.lock('size-3')}</span>` : ''}
      <span class="shrink-0 text-[11.5px] text-fg-3">${kind === 'review' ? t.nextReview : DATA.roadmap.name}</span>
      ${active ? `<span class="text-fg-3">${I.enter('size-3.5')}</span>` : ''}</div>`;
  };
  const k = (s) => `<kbd class="kbd">${s}</kbd>`;
  const footer = (legend) => `<div class="mt-1.5 flex h-9 items-center gap-2 border-t border-line bg-(--ls-footer) px-3 text-[11.5px] text-fg-3">
    <span class="flex min-w-0 flex-1 items-center gap-1.5 truncate">${legend}</span><a class="grid size-6 place-items-center rounded-md">${I.yt('size-3.5')}</a></div>`;
  if (state === 'saved') {
    const color = RATING[theme][3];
    return wrap(`${header}${label(t.saved)}
      <div role="status" class="mx-1.5 flex h-8 items-center gap-2.5 rounded-md px-1.5">
        <span class="grid size-[18px] place-items-center rounded-full" style="background:${mix(color, 16)};color:${color}">${I.check('size-3')}</span>
        <span class="flex-1 font-medium">${t.ratings[3]} <span class="font-normal text-fg-3">· ${t.reviewIn(3)}</span></span>
        <span class="text-[11.5px] text-fg-3">${t.undo} ${k('Z')}</span></div>
      ${label(t.upNext)}${nextItem('review', true)}${nextItem('roadmap')}
      ${footer(`${k('↑')}${k('↓')} ${lang === 'zh' ? '选择' : 'select'} <span class="mx-1">·</span> ${k('↵')} ${lang === 'zh' ? '打开' : 'open'} <span class="mx-1">·</span> ${k('esc')} ${t.esc}`)}`);
  }
  const sel = state === 'select';
  return wrap(`${header}
    ${state === 'loadfail' ? `<div class="pt-1.5">${aBanner(c, t.loadFailed, true)}</div>` : ''}
    ${label(t.how)}${G.map((g) => item(g, { active: !sel && (c.hover ?? 3) === g, sel: sel && g === 3, dim: sel && g !== 3 })).join('')}
    <div class="mx-1.5 flex h-8 items-center gap-2.5 rounded-md px-1.5 text-fg-2 ${sel ? 'opacity-45' : ''}"><span class="grid size-[18px] place-items-center rounded-[5px] bg-raised text-[11px] font-semibold text-fg-3">5</span>${t.without}</div>
    ${state === 'loading' || state === 'loadfail' ? '' : `${label(t.upNext)}${nextItem('review')}${nextItem('roadmap')}`}
    ${c.hint ? `<div class="mx-3 mt-2 text-[11.5px] text-fg-3">${t.hint} <button class="font-medium text-fg-2">${t.off}</button></div>` : ''}
    ${footer(`${k('1')}–${k('5')} ${t.rate} <span class="mx-1">·</span> ${k('esc')} ${t.esc}`)}`);
}

function buttonC(c, { focus } = {}) {
  return `<button id="lsrs-btn" class="ml-1 flex h-8 items-center gap-1.5 rounded-[6px] pr-2.5 pl-2 text-[13px] font-medium text-(--host-fg) ${focus ? 'ring-focus-out' : ''}" style="background:var(--host-fill)"><span class="text-brand">${I.logo('size-4')}</span>${c.lang === 'zh' ? '评分' : 'Rate'}</button>`;
}

export const DIRS = {
  A: { name: 'Quiet list', panel: panelA, button: buttonA },
  B: { name: 'Scale', panel: panelB, button: buttonB },
  C: { name: 'Palette', panel: panelC, button: buttonC },
};
