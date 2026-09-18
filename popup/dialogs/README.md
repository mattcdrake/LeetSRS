# Popup dialogs

[`popupDialogRegistry`](registry.ts) defines display order. The host loads eligibility
and local acknowledgments, then shows one eligible, unacknowledged dialog at a time.
It owns the modal shell, Escape/outside-click dismissal, and persistence.

Dismissal closes immediately; the next dialog waits for the save attempt, even if
it fails. Closing the popup dismisses only the displayed dialog. Failed saves may
cause it to reappear next time.

## Add a dialog

1. Create a `Content` component accepting `PopupDialogContentProps`. Include a
   React Aria `Heading` with `slot="title"`; call `onDismiss` from dismissal actions.
   For an action that opens a popup view, call `onNavigate(view)` (e.g.
   `onNavigate('roadmaps')`). The host dismisses and acknowledges the dialog before
   navigating.
2. Register its stable `id`, async `loadEligibility`, and `Content` in display order:
   - **Release notes:** replace the current release entry and content with a new
     versioned ID, e.g. `release-1.1`. Never retain older release entries.
   - **Other dialogs:** add an independent entry with a unique ID. Keep it when
     replacing release notes.
3. If eligibility can change while open, invalidate `dialogEligibilityQueryKey(id)`
   when its source changes.

Keep IDs stable across copy edits; changing an ID makes the dialog eligible again.
