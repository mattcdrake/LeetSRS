# Auto-reset cleanup

Context: [#284](https://github.com/mattcdrake/LeetSRS/issues/284).
`content/auto-reset.ts` mixes scheduling, LeetCode DOM automation, and presentation;
retry behavior is implicit in several flags.

- [x] Extract the reset interaction into `resetLeetcodeEditor()`: keep button
  discovery, modal snapshotting, confirmation polling, selectors, and localized
  label fallbacks together. Leave scheduling and background RPCs in `auto-reset.ts`.
- [x] Make attempt outcomes explicit at the extraction boundary: `unavailable`,
  `confirmed`, and `confirmation-timeout`. Preserve current behavior: a missing
  reset button remains retryable; a confirmation timeout marks the slug handled.
  Automatically retrying a timeout needs care because the first dialog may remain open.
- [x] Move the toast into presentation code, using a callback such as
  `onResetConfirmed`. Let the UI own styling and timers while automation stays
  outside React, consistent with #284.
- [ ] Consolidate scheduling guards. Navigation detection, throttling, and concurrency
  checks are split between two functions. Record `lastAttemptAt` only when an
  attempt starts; currently it advances even when `isResetting` prevents an attempt.
  Rename `checkForNavigation` to reflect same-page retries.
- [ ] Give pending work a lifecycle under #216. Cleanup stops future checks but
  outstanding RPCs and confirmation polls can still click afterward. Navigation
  during an RPC can apply the previous problem's decision to the new page.
  #284 assigns stale auto-reset cancellation and problem-session identity to #216.

Preserve the modal snapshot safeguard, but describe it accurately: it excludes
existing dialogs; it does not prove a newly opened dialog belongs to our reset click.

Start with extraction and explicit outcomes while preserving retry behavior;
follow with presentation separation and lifecycle work.
