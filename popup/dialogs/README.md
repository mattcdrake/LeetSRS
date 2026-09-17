# Popup dialogs

[`popupDialogRegistry`](registry.ts) lists automatic dialogs in display order:
GitHub migration first, then the current release announcement. Each entry has a
unique, stable `id`, an async `loadEligibility` function, and a `Content` component.
Content supplies a React Aria `Heading` with `slot="title"` and calls `onDismiss`
from its dismissal actions. The host supplies the shared modal shell, including
Escape and outside-click dismissal. Content can also use `onOpenSettings` when
navigation to Settings is available.

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

GitHub migration still uses the legacy `migrationNotice` flag for eligibility, so
fresh installs and users who previously dismissed it skip the notice. New
dismissals use the `github-migration` acknowledgment and leave the legacy migration
record, including the previous backup suggestion, intact. Legacy notice changes
also refresh eligibility, for example when a backup is connected.

## Replacing the release announcement

The `release-1.0` entry and [`ReleaseAnnouncement`](ReleaseAnnouncement.tsx) contain
placeholder content. Final release copy, actions, links, and About changes are
separate work.

For the next announcement:

1. Replace the existing release entry in the registry with a new stable ID, such
   as `release-1.1`. Do not append historical release entries.
2. Replace its content and translations with the new announcement.
3. Keep independent entries such as `github-migration` and their IDs unchanged.

Users who skip 1.0 will then see only the current release announcement. Old release
acknowledgments may stay in local storage; they do not suppress the new ID or
independent dialogs.
