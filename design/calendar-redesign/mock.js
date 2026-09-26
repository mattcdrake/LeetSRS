// Static mockup renderer: ?dir=A|B|C&scene=today|heavy|empty&theme=light|dark
const q = new URLSearchParams(location.search);
const DIR = q.get('dir') || 'A';
const ZH = q.get('lang') === 'zh';
const SCENE = q.get('scene') || 'today';
if (q.get('theme') === 'dark') document.documentElement.classList.add('dark');

const P = {
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  yt: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  calCheck: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  calDays: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, cls = 'size-4', sw = 2) =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

// ---------- data ----------
const TODAY = new Date(2026, 8, 26);
const key = (d) => `${d.getMonth() + 1}-${d.getDate()}`;
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const same = (a, b) => key(a) === key(b);
const loads =
  SCENE === 'empty'
    ? {}
    : {
        '9-26': { r: 3, n: 2, o: 1 },
        '9-27': { r: 1, n: 2 },
        '9-28': { r: 2, n: 2 },
        '9-29': SCENE === 'heavy' ? { r: 10, n: 2 } : { r: 1 },
        '10-1': { r: 3 },
        '10-2': { r: 1 },
        '10-3': { r: 3, n: 1 },
        '10-5': { r: 2 },
        '10-7': { r: 1 },
        '10-9': { r: 5, n: 1 },
        '10-12': { r: 2 },
        '10-14': { r: 1 },
        '10-16': { r: 3 },
        '10-20': { r: 1 },
        '10-23': { r: 2 },
      };
const load = (d) => {
  const l = loads[key(d)] || {};
  return { r: l.r || 0, n: l.n || 0, o: l.o || 0, c: (l.r || 0) + (l.n || 0) };
};
const level = (c) => (c === 0 ? 0 : c <= 2 ? 1 : c <= 4 ? 2 : c <= 7 ? 3 : 4);
const SELECTED = SCENE === 'heavy' ? new Date(2026, 8, 29) : TODAY;

const todayRows = ZH ? [
  { id: '1', t: '两数之和', d: 'easy', yt: 1, tag: 'overdue', od: '2d' },
  { id: '20', t: '有效的括号', d: 'easy', yt: 1 },
  { id: '49', t: '字母异位词分组', d: 'medium', yt: 1 },
  { id: '217', t: '存在重复元素', d: 'easy', tag: 'new' },
  { id: '242', t: '有效的字母异位词', d: 'easy', yt: 1, tag: 'new' },
] : [
  { id: '1', t: 'Two Sum', d: 'easy', yt: 1, tag: 'overdue', od: '2d' },
  { id: '20', t: 'Valid Parentheses', d: 'easy', yt: 1 },
  { id: '49', t: 'Group Anagrams', d: 'medium', yt: 1, hover: 1 },
  { id: '217', t: 'Contains Duplicate', d: 'easy', tag: 'new' },
  { id: '242', t: 'Valid Anagram', d: 'easy', yt: 1, tag: 'new' },
];
const heavyRows = [
  ['11', 'Container With Most Water', 'medium'],
  ['23', 'Merge k Sorted Lists', 'hard'],
  ['42', 'Trapping Rain Water', 'hard'],
  ['56', 'Merge Intervals', 'medium'],
  ['70', 'Climbing Stairs', 'easy'],
  ['76', 'Minimum Window Substring', 'hard'],
  ['98', 'Validate Binary Search Tree', 'medium'],
  ['139', 'Word Break', 'medium'],
  ['226', 'Invert Binary Tree', 'easy'],
  ['238', 'Product of Array Except Self', 'medium'],
  ['271', 'Encode and Decode Strings', 'medium', 'new'],
  ['347', 'Top K Frequent Elements', 'medium', 'new'],
].map(([id, t, d, tag]) => ({ id, t, d, yt: 1, tag }));
const rows = SCENE === 'heavy' ? heavyRows : SCENE === 'empty' ? [] : todayRows;

const WD = ZH ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WSTART = ZH ? 1 : 0;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DIFF = ZH ? { easy: '简单', medium: '中等', hard: '困难' } : { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

// ---------- shared pieces ----------
const sep = '<span aria-hidden="true" class="text-tertiary">·</span>';
function row(p) {
  const tag =
    p.tag === 'overdue'
      ? `${sep}<span class="text-warn">${ZH ? '逾期 2 天' : `Overdue ${p.od}`}</span>`
      : p.tag === 'new'
        ? `${sep}<span class="text-accent">${ZH ? '新题' : 'New'}</span>`
        : '';
  return `<li class="flex min-h-12 items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg ${p.hover ? 'hover-row' : ''}">
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-1 text-[13px] leading-[18px]">
        <span class="shrink-0 text-tertiary tabular-nums">${p.id}.</span><span class="truncate">${p.t}</span>${icon('arrow', 'size-3 shrink-0 text-tertiary')}
      </div>
      <div class="mt-0.5 flex items-center gap-1 text-xs leading-4">
        <span class="inline-flex items-center gap-1" style="color:var(--current-difficulty-${p.d})"><span class="size-1.5 rounded-full bg-current"></span>${DIFF[p.d]}</span>${tag}
      </div>
    </div>
    ${
      p.yt
        ? `<span class="size-8 -mr-1 shrink-0 rounded-md grid place-items-center text-tertiary ${p.hover ? 'bg-tertiary text-primary' : ''}">${icon('yt', 'size-4', 1.75)}</span>`
        : '<span class="size-8 -mr-1 shrink-0"></span>'
    }
  </li>`;
}

function summary(d) {
  const l = load(d);
  if (!l.c) return '';
  let s = `<span class="text-primary font-medium">${l.c}</span> ${ZH ? '到期' : 'due'}`;
  if (l.o) s += ` ${sep} <span class="text-warn">${l.o} ${ZH ? '逾期' : 'overdue'}</span>`;
  if (l.n) s += ` ${sep} <span class="text-accent">${l.n} ${ZH ? '新题' : 'new'}</span>`;
  return `<p class="text-xs text-tertiary tabular-nums whitespace-nowrap">${s}</p>`;
}

function dayTitle(d) {
  if (ZH) return `${same(d, TODAY) ? '今天' : `周${'日一二三四五六'[d.getDay()]}`} <span class="font-normal text-tertiary">${d.getMonth() + 1}月${d.getDate()}日</span>`;
  const rel = same(d, TODAY) ? 'Today' : same(d, add(TODAY, 1)) ? 'Tomorrow' : WDL[d.getDay()];
  const sub = `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  return rel === WDL[d.getDay()] ? `${rel} <span class="font-normal text-tertiary">${MON[d.getMonth()]} ${d.getDate()}</span>` : `${rel} <span class="font-normal text-tertiary">${sub}</span>`;
}

function dayHeader(d, extra = '') {
  return `<div class="sticky top-0 z-[1] bg-primary flex items-baseline justify-between gap-3 pt-3 pb-1.5 ${extra}">
    <h2 class="text-[13px] font-semibold truncate">${dayTitle(d)}</h2>${summary(d)}
  </div>`;
}

function emptyAll() {
  return `<div class="flex items-center gap-3 rounded-xl px-3.5 py-3 bg-secondary mt-1">
    <span class="size-8 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center">${icon('calCheck', 'size-4')}</span>
    <div><p class="text-[13px] font-semibold">Nothing scheduled yet</p>
    <p class="text-xs text-tertiary">Save a problem from Home or Roadmaps and its reviews appear here.</p></div>
  </div>`;
}

function dayList(d) {
  if (SCENE === 'empty') return dayHeader(d) + emptyAll();
  return `${dayHeader(d)}<ul>${rows.map(row).join('')}</ul>`;
}

const btnGhost = 'size-8 rounded-md grid place-items-center';
function navControls(label, { prevDisabled = true, todayActive = SCENE === 'heavy', extra = '' } = {}) {
  return `<div class="flex items-center justify-between h-8">
    <h2 class="text-[15px] font-semibold tracking-tight">${label}</h2>
    <div class="flex items-center gap-1">
      ${extra}
      <span class="h-7 px-2.5 rounded-md border border-strong text-xs font-medium grid place-items-center ${todayActive ? 'text-primary' : 'text-tertiary opacity-60'}">${ZH ? '今天' : 'Today'}</span>
      <span class="flex items-center -mr-1.5">
        <span class="${btnGhost} text-tertiary ${prevDisabled ? 'opacity-40' : ''}">${icon('chevL')}</span>
        <span class="${btnGhost} text-secondary">${icon('chevR')}</span>
      </span>
    </div>
  </div>`;
}

const weekdayRow = (cls = '') =>
  `<div class="grid grid-cols-7 h-6 items-center text-center text-[11px] text-tertiary ${cls}">${[...WD.slice(WSTART), ...WD.slice(0, WSTART)].map((w) => `<span>${w}</span>`).join('')}</div>`;

// ---------- Direction A: Quiet month (dot density) ----------
function dirA() {
  const start = new Date(2026, 7, 30);
  let cells = '';
  for (let i = 0; i < 35; i++) {
    const d = add(start, i);
    const past = d < TODAY;
    const outside = d.getMonth() !== 8;
    const sel = same(d, SELECTED);
    const isToday = same(d, TODAY);
    const l = load(d);
    const n = [0, 1, 2, 3, 3][level(l.c)];
    let cls = 'text-primary';
    if (past || outside) cls = 'text-tertiary opacity-45';
    if (outside && !past) cls = 'text-tertiary';
    if (isToday) cls = 'text-accent font-semibold';
    if (sel) cls = 'bg-accent text-on-accent font-semibold';
    const dotColor = sel ? 'bg-current' : outside ? 'bg-accent opacity-50' : 'bg-accent';
    let dots = '';
    if (l.o) dots += `<span class="size-1 rounded-full ${sel ? 'bg-current' : 'bg-[var(--current-warning)]'}"></span>`;
    for (let k = 0; k < n - (l.o ? 1 : 0); k++) dots += `<span class="size-1 rounded-full ${dotColor}"></span>`;
    const hide = past && d.getMonth() !== 8;
    cells += `<div class="flex justify-center"><div class="w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-[3px] text-[13px] tabular-nums ${cls} ${hide ? 'invisible' : ''}">
      <span class="leading-4">${d.getDate()}</span><span class="h-1 flex gap-[2px]">${dots}</span></div></div>`;
  }
  return `<div class="px-4 pt-3">
    ${navControls('September <span class="font-normal text-tertiary">2026</span>')}
    ${weekdayRow('mt-1')}
    <div class="grid grid-cols-7 gap-y-0.5">${cells}</div>
    <div class="mt-2 border-t border-current">${dayList(SELECTED)}</div>
  </div>`;
}

// ---------- Direction B: Two-week strip + agenda ----------
function dirB() {
  const start = new Date(2026, 8, 20);
  let cells = '';
  for (let i = 0; i < 14; i++) {
    const d = add(start, i);
    const past = d < TODAY;
    const sel = same(d, SELECTED);
    const isToday = same(d, TODAY);
    const l = load(d);
    const h = (c) => (c ? Math.min(3 + c * 2.5, 24) : 0);
    const tot = h(l.c);
    const newH = h(l.n);
    const oH = h(l.o);
    const revH = h(l.c) - newH - oH;
    let num = 'text-primary';
    if (past) num = 'text-tertiary opacity-45';
    if (isToday) num = 'text-accent font-semibold';
    const bar =
      l.c && !past
        ? `<div class="w-2.5 flex flex-col-reverse rounded-[3px] overflow-hidden" style="height:${tot}px">
            <span style="height:${Math.round((tot * (l.c - l.n)) / l.c)}px" class="bg-accent"></span>
            ${l.n ? `<span style="height:${Math.round((tot * l.n) / l.c)}px" class="bg-accent opacity-35"></span>` : ''}
          </div>`
        : past
          ? ''
          : '';
    cells += `<div class="flex justify-center"><div class="w-10 h-[56px] rounded-lg flex flex-col items-center pt-1.5 gap-1.5 ${sel ? 'bg-tertiary' : ''}">
      <span class="text-[13px] leading-4 tabular-nums ${num} ${sel ? 'font-semibold' : ''}">${d.getDate() === 1 ? `<span class="text-[10px] font-medium text-tertiary mr-px">Oct</span>` : ''}${d.getDate()}</span>
      <div class="h-[24px] flex items-end">${bar}</div></div></div>`;
  }
  // agenda: selected day expanded, then the following days collapsed
  let later = '';
  if (SCENE !== 'empty') {
    let d = add(SELECTED, 1);
    let shown = 0;
    while (shown < 4) {
      const l = load(d);
      if (l.c) {
        later += `<div class="flex items-center justify-between h-10 border-t border-current text-[13px]">
          <span>${dayTitle(d)}</span>
          <span class="flex items-center gap-1 text-xs text-tertiary tabular-nums">${l.c} due${icon('chevR', 'size-3.5')}</span></div>`;
        shown++;
      }
      d = add(d, 1);
    }
  }
  const wk = SCENE === 'empty' ? [0, 0] : SCENE === 'heavy' ? [28, 6] : [17, 6];
  return `<div class="px-4 pt-3">
    ${navControls('Sep 20 <span class="text-tertiary font-normal">–</span> Oct 3', {
      extra: `<span class="${btnGhost} text-secondary" title="Show month">${icon('calDays')}</span>`,
    })}
    <div class="mt-2 rounded-xl border border-current bg-surface shadow-card px-1 pb-1.5">
      ${weekdayRow('h-7')}
      <div class="grid grid-cols-7 gap-y-1">${cells}</div>
    </div>
    ${SCENE === 'empty' ? '' : `<div class="flex items-center justify-between mt-2 px-0.5 text-[11px] text-tertiary tabular-nums">
      <span>Next 7 days</span>
      <span class="inline-flex items-center gap-1"><span class="w-1.5 h-2.5 rounded-[2px] bg-accent"></span><span class="text-primary font-medium">${wk[0] - wk[1]}</span> review <span class="w-1.5 h-2.5 rounded-[2px] bg-accent opacity-35 ml-1.5"></span><span class="text-primary font-medium">${wk[1]}</span> new</span>
    </div>`}
    <div class="mt-1">${dayList(SELECTED)}${later}</div>
  </div>`;
}

// ---------- Direction C: Forecast heatmap ----------
function dirC() {
  const start = new Date(2026, 8, 20 + WSTART);
  let cells = '';
  for (let i = 0; i < 28; i++) {
    const d = add(start, i);
    const past = d < TODAY;
    const sel = same(d, SELECTED);
    const isToday = same(d, TODAY);
    const l = load(d);
    const lv = past ? 0 : level(l.c);
    let num = lv === 4 ? '' : 'text-primary';
    if (past) num = 'text-tertiary opacity-45';
    const label = d.getDate() === 1 ? `<span class="font-medium">${ZH ? '10月' : 'Oct&nbsp;1'}</span>` : d.getDate();
    cells += `<div class="relative h-[30px] rounded-md grid place-items-center text-[12px] tabular-nums heat-${lv} ${num} ${sel ? 'ring-sel font-semibold' : ''} ${isToday ? 'font-semibold' : ''}">
      ${label}${isToday ? '<span class="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full bg-current"></span>' : ''}
      ${l.o && !past ? '<span class="absolute top-1 right-1 size-1.5 rounded-full bg-[var(--current-warning)]"></span>' : ''}
    </div>`;
  }
  const stat = (label, value, note) =>
    `<div class="px-3 min-w-0"><p class="text-[11px] text-tertiary truncate">${label}</p>
     <p class="mt-0.5 text-[17px] leading-5 font-semibold tabular-nums tracking-tight">${value}${note ? ` <span class="text-[11px] font-normal">${note}</span>` : ''}</p></div>`;
  const s =
    SCENE === 'empty'
      ? [stat('Today', '0'), stat('Next 7 days', '0'), stat('New queued', '0')]
      : [
          stat(ZH ? '今天' : 'Today', '5', `<span class="text-warn">${ZH ? '1 逾期' : '1 late'}</span>`),
          stat(ZH ? '未来 7 天' : 'Next 7 days', SCENE === 'heavy' ? '28' : '17'),
          stat(ZH ? '待学新题' : 'New queued', '6', `<span class="text-tertiary">${ZH ? '每天 2' : '2/day'}</span>`),
        ];
  return `<div class="px-4 pt-3">
    ${navControls(ZH ? '9月21日 <span class="text-tertiary font-normal">–</span> 10月18日' : 'Sep 20 <span class="text-tertiary font-normal">–</span> Oct 17')}
    <div class="mt-2 rounded-xl border border-current bg-surface shadow-card">
      <div class="px-2 pb-2">
        ${weekdayRow('h-7')}
        <div class="grid grid-cols-7 gap-1">${cells}</div>
      </div>
    </div>
    <div>${dayList(SELECTED)}</div>
  </div>`;
}

// ---------- shell ----------
function navItem(ic, active, badge) {
  if (active)
    return `<span class="flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-secondary text-primary text-xs font-medium">${icon(ic, 'size-4 shrink-0')}${ZH ? '日历' : 'Calendar'}</span>`;
  return `<span class="flex items-center justify-center h-8 ${badge ? 'gap-1 px-2' : 'w-10'} rounded-md text-tertiary">${icon(ic, 'size-4 shrink-0', 1.75)}${
    badge ? `<span class="min-w-4 h-4 px-1 rounded bg-accent-soft text-accent text-[11px] font-semibold grid place-items-center tabular-nums">${badge}</span>` : ''
  }</span>`;
}
const body = { A: dirA, B: dirB, C: dirC }[DIR]();
document.getElementById('root').innerHTML = `
  <div class="flex flex-col h-full bg-primary text-primary">
    <header class="flex items-center h-11 px-4 bg-primary border-b border-current shrink-0">
      <h1 class="text-[15px] font-semibold tracking-tight font-jetbrains-mono">${ZH ? '日历' : 'Calendar'}</h1>
    </header>
    <main class="flex-1 overflow-y-auto overflow-x-hidden pb-3">${body}</main>
    <nav class="h-11 border-t border-current bg-primary flex justify-between items-center px-2.5 shrink-0">
      ${navItem('home', false, SCENE === 'empty' ? '' : '5')}${navItem('route')}${navItem('cal', true)}${navItem('layers')}${navItem('gear')}
    </nav>
  </div>`;
