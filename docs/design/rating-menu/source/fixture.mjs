// A LeetCode-like problem page: nav with #ide-top-btns, description and editor panels.
export function fixtureHtml({ dark = false, title = '1. Two Sum', cn = false, extraToolbar = '' } = {}) {
  return `<!doctype html>
<html lang="en" class="${dark ? 'dark' : ''}">
<head><meta charset="utf-8"><title>${title} - LeetCode</title>
<style>
  :root { --bg:#f0f0f0; --panel:#ffffff; --text:#262626; --muted:rgba(38,38,38,.6); --line:rgba(0,0,0,.08);
    --fill:rgba(0,0,0,.04); --fill-h:rgba(0,0,0,.08); --green:#2db55d; --code:#1a1a1a; --kw:#0000ff; --str:#a31515; --gut:#999; --chip:#f2f3f4 }
  html.dark { --bg:#1a1a1a; --panel:#262626; --text:#eff1f6bf; --muted:rgba(239,241,246,.45); --line:rgba(255,255,255,.08);
    --fill:rgba(255,255,255,.1); --fill-h:rgba(255,255,255,.16); --green:#2cbb5d; --code:#d4d4d4; --kw:#569cd6; --str:#ce9178; --gut:#6e7681; --chip:#373737 }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; }
  body { background:var(--bg); color:var(--text); font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; display:flex; flex-direction:column; overflow:hidden; }
  nav { height:48px; flex:none; display:flex; align-items:center; justify-content:space-between; padding:0 12px; }
  .left, .right { display:flex; gap:10px; align-items:center; flex:1; }
  .right { justify-content:flex-end; }
  .logo { width:22px; height:22px; border-radius:5px; background:linear-gradient(135deg,#ffa116,#f89f1b); }
  .navtxt { font-size:14px; font-weight:500; }
  .ib { width:32px; height:32px; border-radius:6px; display:grid; place-items:center; color:var(--muted); }
  .ib:hover { background:var(--fill); }
  #ide-top-btns { display:flex; align-items:center; gap:1px; }
  #ide-top-btns > .tb { height:32px; display:flex; align-items:center; gap:6px; padding:0 12px; background:var(--fill); border:0; color:var(--text); font:inherit; font-weight:500; cursor:pointer; }
  #ide-top-btns > .tb:hover { background:var(--fill-h); }
  #ide-top-btns > .first { border-radius:6px 0 0 6px; }
  #ide-top-btns > .last-in-group { border-radius:0 6px 6px 0; }
  #ide-top-btns > .solo { border-radius:6px; margin-left:8px; padding:0 8px; }
  #ide-top-btns > .submit { color:var(--green); }
  .prem { color:#ffa116; font-weight:500; font-size:13px; background:rgba(255,161,22,.12); padding:4px 10px; border-radius:6px; }
  .avatar { width:28px; height:28px; border-radius:50%; background:#8a9bb0; }
  main { flex:1; display:flex; gap:8px; padding:0 8px 8px; min-height:0; }
  .panel { background:var(--panel); border-radius:8px; border:1px solid var(--line); display:flex; flex-direction:column; min-width:0; overflow:hidden; }
  .desc { flex: 1 1 46%; }
  .edit { flex: 1 1 54%; }
  .tabs { height:36px; display:flex; align-items:center; gap:16px; padding:0 12px; border-bottom:1px solid var(--line); font-size:13px; background:color-mix(in srgb,var(--fill) 60%,var(--panel)); }
  .tabs b { font-weight:500; }
  .tabs span { color:var(--muted); }
  .content { padding:16px 20px; overflow:hidden; }
  h1 { font-size:24px; margin:0 0 12px; font-weight:600; }
  .chips { display:flex; gap:8px; margin-bottom:16px; }
  .chip { font-size:12px; padding:2px 10px; border-radius:999px; background:var(--chip); }
  .chip.easy { color:#00b8a3; }
  p { margin: 0 0 12px; }
  code.i { font-family:Menlo,monospace; font-size:12px; background:var(--chip); padding:1px 4px; border-radius:4px; }
  .ed-top { height:36px; display:flex; align-items:center; justify-content:space-between; padding:0 8px 0 12px; border-bottom:1px solid var(--line); font-size:13px; }
  .ed-top .l { display:flex; gap:8px; align-items:center; color:var(--muted); }
  .ed-top .r { display:flex; gap:2px; }
  .ed-top .ib { width:26px; height:26px; }
  pre { margin:0; padding:8px 0; font: 13px/20px Menlo, "DejaVu Sans Mono", monospace; color:var(--code); flex:1; }
  pre .ln { display:inline-block; width:40px; text-align:right; padding-right:16px; color:var(--gut); }
  .kw { color:var(--kw); } .st { color:var(--str); }
  .tc { height:34%; border-top:1px solid var(--line); }
  dialog[open] { border:1px solid var(--line); background:var(--panel); color:var(--text); border-radius:8px; padding:20px; }
</style></head>
<body>
<nav>
  <div class="left"><div class="logo"></div><span class="navtxt">Problem List</span><span class="ib">‹</span><span class="ib">›</span><span class="ib">⤨</span></div>
  <div id="ide-top-btns">
    <button class="tb first" data-e2e-locator="console-run-button">▶ Run</button>
    <button class="tb last-in-group submit" data-e2e-locator="console-submit-button">☁ Submit</button>
    ${extraToolbar}
    <button class="tb solo" aria-label="Notes">✎</button>
  </div>
  <div class="right"><span class="ib">⚙</span><span class="ib">◷</span><span class="prem">Premium</span><span class="avatar"></span></div>
</nav>
<main>
  <section class="panel desc">
    <div class="tabs"><b>Description</b><span>Editorial</span><span>Solutions</span><span>Submissions</span></div>
    <div class="content">
      <h1>${title}</h1>
      <div class="chips"><span class="chip easy">Easy</span><span class="chip">Topics</span><span class="chip">Companies</span><span class="chip">Hint</span></div>
      <p>Given an array of integers <code class="i">nums</code> and an integer <code class="i">target</code>, return <em>indices of the two numbers such that they add up to <code class="i">target</code></em>.</p>
      <p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.</p>
      <p>You can return the answer in any order.</p>
      <p><strong>Example 1:</strong></p>
      <p style="border-left:2px solid var(--line);padding-left:12px;font-family:Menlo,monospace;font-size:13px">Input: nums = [2,7,11,15], target = 9<br>Output: [0,1]<br>Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].</p>
      <p><strong>Example 2:</strong></p>
      <p style="border-left:2px solid var(--line);padding-left:12px;font-family:Menlo,monospace;font-size:13px">Input: nums = [3,2,4], target = 6<br>Output: [1,2]</p>
    </div>
  </section>
  <section class="panel edit">
    <div class="ed-top"><div class="l"><b style="color:var(--text);font-weight:500">&lt;/&gt; Code</b><span>Python3 ⌄</span><span>Auto</span></div>
      <div class="r"><span class="ib">≡</span><span class="ib">{ }</span><button class="ib" id="reset" style="border:0;background:none;color:inherit" aria-label="Reset"><svg class="fa-arrow-rotate-left" data-icon="arrow-rotate-left" width="14" height="14" viewBox="0 0 16 16"><path d="M3 8a5 5 0 1 0 1.5-3.5M3 2v3h3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button><span class="ib">⤢</span></div></div>
    <pre>${[
      '<span class="kw">class</span> Solution:',
      '    <span class="kw">def</span> twoSum(self, nums: List[int], target: int) -&gt; List[int]:',
      '        seen = {}',
      '        <span class="kw">for</span> i, n <span class="kw">in</span> enumerate(nums):',
      '            <span class="kw">if</span> target - n <span class="kw">in</span> seen:',
      '                <span class="kw">return</span> [seen[target - n], i]',
      '            seen[n] = i',
      '        <span class="kw">return</span> []',
      '',
    ]
      .map((l, i) => `<span class="ln">${i + 1}</span>${l}`)
      .join('\n')}</pre>
    <div class="tc"><div class="tabs"><b>Testcase</b><span>Test Result</span></div>
      <div class="content" style="font-size:13px;color:var(--muted)">Case 1 &nbsp; Case 2 &nbsp; Case 3<br><br>nums =<br><span style="font-family:Menlo,monospace;color:var(--text)">[2,7,11,15]</span></div></div>
  </section>
</main>
<script>
  document.getElementById('reset').addEventListener('click', () => {
    const d = document.createElement('div');
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<p>Reset code?</p><button>Cancel</button><button>Confirm</button>';
    d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => d.remove()));
    document.body.append(d);
  });
</script>
</body></html>`;
}
