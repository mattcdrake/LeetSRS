# Issue #165: simplify rating menu coordination

- [x] Define ownership and rapid-interaction semantics.
  - `entrypoints/content.ts` owns translation loading, the desired open/closed state, and a monotonically increasing interaction version.
  - Each click updates the desired state. Closing is synchronous and invalidates any pending open; an open may render only when its translation request is still current and the desired state is still open.
  - A stale success or failure has no UI effect. A current translation failure is logged at the content-script boundary, leaves the menu closed, and resets the desired state so the next click retries opening.
  - Translations are resolved for every open attempt, preserving language changes without a page reload.
- [x] Extract a content-script rating-menu coordinator with a small testable interface. It loads translations, applies the interaction version checks above, and calls only synchronous menu operations.
- [x] Refactor `RatingMenu` so it owns only synchronous visibility and event-listener state. Pass resolved `Translations` to `show`/`toggle` instead of injecting an async loader or tracking an opening request.
- [x] Separate DOM construction from menu visibility state by extracting the menu-element/button construction from the `RatingMenu` state transitions.
- [x] Update content-script setup to create and invoke the coordinator, keeping rating and add-card callbacks unchanged.
- [ ] Rewrite `RatingMenu` tests around synchronous rendering, hiding, callbacks, positioning, outside clicks, hover behavior, and translated labels.
- [ ] Add coordinator tests for rapid open/close/open clicks, out-of-order stale requests, closing while a request is pending, and current versus stale translation failures.
- [ ] Run `npm run check` and resolve any failures.
