---
status: accepted
---

# Use direct whole-dataset Gist sync

Supersede [ADR-0004](0004-background-sync-lifecycle.md)'s trigger-specific sync lifecycle. Gist sync has one mode: enabled or disabled. Saving a new or existing Gist connection enables syncing. When enabled, LeetSRS syncs after setup, at background startup, after a successful local edit, when syncing is enabled, and from a one-minute retry alarm. There is no manual sync action and opening or returning to a popup or LeetCode tab does not trigger or block on sync.

Every trigger calls the same whole-document last-write-wins operation from [ADR-0002](0002-whole-dataset-gist-sync.md): download and validate the Gist, read the current local document, compare `dataUpdatedAt`, replace the older document, and record status. Overlapping triggers share one in-flight promise. They do not queue a follow-up, so an edit made after an upload has started may wait for the next one-minute attempt.

A generation guard prevents document sync started before an import, reset, or connection change from applying a stale result. An already-issued storage write or upload cannot be undone. GitHub and storage failures become stable error codes that the UI translates. Connection setup validates or creates the destination, saves an enabled connection, and starts sync without waiting for its result. It does not recover a created Gist ID after a failed save, model separate connection and status-write outcomes, or coordinate its final write with a concurrent reset or connection update. The last completed connection write wins.

The settings UI states that last-write-wins applies to the entire dataset, not individual cards, and that concurrent changes in another browser can be lost.

Recorded from [issue #437](https://github.com/mattcdrake/LeetSRS/issues/437).
