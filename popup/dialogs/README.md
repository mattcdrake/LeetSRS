# Popup dialogs

[`popupDialogRegistry`](registry.ts) lists automatic dialogs in display order:
currently the release announcement. Each entry has a
unique, stable `id`, an async `loadEligibility` function, and a `Content` component.
Content supplies a React Aria `Heading` with `slot="title"` and calls `onDismiss`
from its dismissal actions. The host supplies the shared modal shell, including
Escape and outside-click dismissal.

`PopupDialogHost` loads all eligibility checks and local acknowledgments before
selecting the first eligible, unacknowledged entry. Pending or failed reads leave
the host hidden until they succeed. Eligibility checks use React Query keys from
`dialogEligibilityQueryKey(id)` so source changes can invalidate them.

Dismissal closes the dialog immediately and calls `acknowledgePopupDialog` in the
background. The next dialog waits for that save attempt to finish. If saving fails,
the queue still advances; the dismissed dialog stays hidden for this mounted host
but may reappear in a later popup. Acknowledgments use stable dialog IDs in local
storage, separate from synced learning data. `useStorageQueryEvents` refreshes the
acknowledgment and eligibility queries when their storage changes and when the
popup mounts.

On `pagehide`, the host dispatches acknowledgment of only the displayed dialog
directly to the background, which owns the save after the popup closes. Closing
while eligibility is loading or a dismissal is saving leaves unshown entries
pending. React unmount and Strict Mode effect cleanup do not acknowledge dialogs.

GitHub migration is a separate persistent green banner below the shared view
header. It uses the legacy PAT migration notice flag and is dismissed only by its
X button. Opening Settings, reconnecting a backup, and closing the popup do not
dismiss it. It does not use dialog acknowledgments or participate in this queue.

## Replacing the release announcement

The `release-1.0` entry and [`ReleaseAnnouncement`](ReleaseAnnouncement.tsx) contain
placeholder content. Final release copy, actions, links, and About changes are
separate work.

For the next announcement:

1. Replace the existing release entry in the registry with a new stable ID, such
   as `release-1.1`. Do not append historical release entries.
2. Replace its content and translations with the new announcement.
3. Keep any independent dialog entries and their IDs unchanged.

Users who skip 1.0 will then see only the current release announcement. Old release
acknowledgments may stay in local storage; they do not suppress the new ID or
independent dialogs.
