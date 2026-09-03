# Remove the animation preference

- [x] Remove the “Enable animations” control and its translations.
- [x] Remove `animationsEnabled` from settings, storage, sync import/export, mocks, and tests.
- [x] Continue accepting older imports containing `animationsEnabled`, but ignore the field.
- [x] Always apply the review-card animation classes.
- [x] Make `getSlideDirection` required because every card action supplies it.
- [x] Replace the duplicated JavaScript timeout with animation-completion handling.
- [x] Preserve the outgoing card and disabled action states until the animation completes.
- [ ] Add an immediate state-cleanup path when `prefers-reduced-motion: reduce` applies, because `animation: none` does not emit `animationend`.
- [ ] Add global reduced-motion CSS that disables nonessential animations and transitions.
- [ ] Update `ReviewQueue` tests for animation completion, reduced motion, card actions, disabled states, and outgoing-card display.
- [ ] Run `npm test` and `npm run compile`.
