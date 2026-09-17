# Popup dialogs

`popupDialogRegistry` lists automatic dialogs in display order. Each entry has a
unique, stable `id`, an async `loadEligibility` function, and a `Content` component.
Content supplies a React Aria `Heading` with `slot="title"` and calls `onDismiss`
from its dismissal actions. The host supplies the shared modal shell, including
Escape and outside-click dismissal.

`PopupDialogHost` loads all eligibility checks before selecting the first eligible
entry. Pending or failed checks leave the host hidden until they succeed. Checks
use React Query keys from `dialogEligibilityQueryKey(id)` so source changes can
invalidate them.

This is the foundation for issue #645. Dismissals currently last only for the
mounted host. Persistent acknowledgments, popup-close handling, migration notice
integration, and the release entry follow in later steps. The registry is empty
and the host is not mounted in `App` until that integration.
