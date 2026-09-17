# Popup dialogs

`popupDialogRegistry` lists automatic dialogs in display order. Each entry has a
unique, stable `id`, an async `loadEligibility` function, and a `Content` component.
Content supplies a React Aria `Heading` with `slot="title"` and calls `onDismiss`
from its dismissal actions. The host supplies the shared modal shell, including
Escape and outside-click dismissal.

`PopupDialogHost` loads all eligibility checks and local acknowledgments before
selecting the first eligible, unacknowledged entry. Pending or failed reads leave
the host hidden until they succeed. Eligibility checks
use React Query keys from `dialogEligibilityQueryKey(id)` so source changes can
invalidate them.

Dismissal closes the dialog immediately and calls `acknowledgePopupDialog` in the
background. The next dialog waits for that save attempt to finish. If saving fails,
the queue still advances; the dismissed dialog stays hidden for this mounted host
but may reappear in a later popup. Acknowledgments use stable dialog IDs in local
storage, separate from synced learning data. `useStorageQueryEvents` refreshes the
acknowledgment query when storage changes and when the popup mounts.

This is the foundation for issue #645. Popup-close handling, migration notice
integration, and the release entry follow in later steps. The registry is empty
and the host is not mounted in `App` until that integration.
