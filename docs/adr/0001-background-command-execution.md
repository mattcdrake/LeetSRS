---
status: accepted
---

# Centralize background command execution

Popup, content, and alarm-driven operations can mutate the same learning data; manually selected wrappers previously allowed mutations such as import and reset to bypass serialization and shared side effects. Declare command behavior in an exhaustive typed registry and execute writes through one background queue, including Gist sync and its network requests, so each mutation waits for the previous one and sync tracking and badge refresh follow explicit ownership. Reads may overlap writes, and a slow sync delays subsequent writes.

[ADR-0003](0003-single-document-learning-data.md) later consolidated learning data and its edit timestamp into one write. Operations spanning the document, connection configuration, sync status, or GitHub can still partially complete.

Recorded from the existing implementation and [issue #154](https://github.com/mattcdrake/LeetSRS/issues/154), implemented in [PR #170](https://github.com/mattcdrake/LeetSRS/pull/170).
