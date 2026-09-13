---
status: accepted
---

# Keep local saves independent of background sync

Supersede [ADR-0001](0001-background-command-execution.md): named workflows save locally and request automatic sync after persistence, without waiting for GitHub or badges. Remove the general write queue, command registry, dispatcher, classification, and effect metadata. Accept overlapping manual edits and the narrow race between a sync comparison and replacement rather than introducing another queue.

The background shares one active sync attempt across manual, arrival, alarm, and post-save triggers. Saves during an attempt request one follow-up using current data. Arrival refresh holds edits until completion or three seconds; background invalidation prevents obsolete attempts from consuming late results or starting more effects after timeout, import, reset, or connection changes. Already-issued storage writes may complete, and an upload already sent cannot be undone. The minute alarm provides periodic sync and retry; automatic triggers respect the connection setting.

Download before comparing fresh local data, retaining [ADR-0002](0002-whole-dataset-gist-sync.md)'s whole-dataset latest-edit-wins policy and imported timestamps. Sync depends on storage and conversions, while local-save workflows depend on sync. Badge refresh reacts independently to document changes and the minute tick. These choices keep popup closure and GitHub availability from deciding whether a local save succeeds.

Recorded from [issue #400](https://github.com/mattcdrake/LeetSRS/issues/400) and its [parent spec](https://github.com/mattcdrake/LeetSRS/issues/401).
