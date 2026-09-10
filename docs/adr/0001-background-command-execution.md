---
status: accepted
---

# Centralize background command execution

Popup, content, and alarm-driven operations can mutate the same learning data; manually selected wrappers previously allowed mutations such as import and reset to bypass serialization and shared side effects. Declare command behavior in an exhaustive typed registry and execute writes through one background queue, including Gist sync and its network requests, so each mutation waits for the previous one and sync tracking and badge refresh follow explicit ownership. Reads may overlap writes, partial writes remain possible, and a slow sync delays subsequent writes.

Recorded from the existing implementation and [issue #154](https://github.com/mattcdrake/LeetSRS/issues/154), implemented in [PR #170](https://github.com/mattcdrake/LeetSRS/pull/170).
