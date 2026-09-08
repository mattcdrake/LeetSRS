# Consolidate note editor presentation

Implementation plan for [#265](https://github.com/mattcdrake/LeetSRS/issues/265).

Extract the duplicated note controls from `NotesSection` and `CardNotes` into
`entrypoints/popup/components/notes/`.

## Implementation

- [x] Move `hooks/useNoteEditor.ts` and its tests into `components/notes/` and
  `components/notes/__tests__/`; update imports and test references.
- [ ] Create `components/notes/NoteEditor.tsx` with `cardId: string` and
  `variant: 'regular' | 'compact'` props. Have it call `useNoteEditor` and render
  the shared React Aria field, label, placeholder, character counter, save/delete
  controls, confirmation styling, and pending states.
- [ ] Implement variant styles: four rows and regular buttons for regular;
  one row, smaller text/buttons, and compact spacing for compact. Move compact
  textarea autosizing into this component, including height reset and the 160px cap.
- [ ] Replace the duplicated editor in `views/home/NotesSection.tsx` with the
  regular component. Change the accordion body to an always-mounted container
  toggled with `hidden` so collapsing it retains the editor's hook state.
- [ ] Replace the duplicated editor in `views/card/components/CardNotes.tsx` with
  the compact component; remove the wrapper's textarea ref and autosizing effect.

## Verification

- [ ] Consolidate common control tests into
  `components/notes/__tests__/NoteEditor.test.tsx`, using `test/utils/` helpers.
  Cover loading, stored text, character limits, save eligibility and payload,
  delete visibility, two-step confirmation, and pending states in both variants.
- [ ] Add home regression tests for unsaved text and confirmation across
  collapse/reopen, mutation completion while collapsed, and hidden controls being
  inaccessible. Update assertions that previously expected DOM removal.
- [ ] Update both wrapper suites to exercise the shared editor and verify the
  supplied card ID. Extend compact autosizing tests to cover growth, shrinkage,
  fetched content, and the 160px cap using controlled `scrollHeight` values.
- [ ] Run focused editor/hook/wrapper tests, `npm run check`, and `npm run build`
  using Node.js 24+. In Codex, run tests and the full check with
  `sandbox_permissions: "require_escalated"` from the first attempt.
- [ ] Inspect the popup in-browser and capture screenshots of home
  collapsed/expanded and compact short/long notes. Check light/dark appearance,
  scrolling, confirmation, and pending states.

## Acceptance criteria

Both views use the shared editor and retain their surrounding layout, accessible
labels, translations, and existing control behavior. Home starts collapsed and
retains editor state across toggles; hidden controls cannot receive keyboard focus.
Compact notes grow and shrink with content, scrolling beyond 160px.

The moved hook retains current fetched-data synchronization, card-switch behavior,
failed-save rollback, deletion failure handling, and confirmation timeout behavior.
Its existing tests remain the regression baseline. Existing load-error diagnostics
and popup query/RPC boundaries also remain intact.

Draft transitions and actionable mutation feedback belong to
[#221](https://github.com/mattcdrake/LeetSRS/issues/221); error codes and translations
belong to [#248](https://github.com/mattcdrake/LeetSRS/issues/248).
