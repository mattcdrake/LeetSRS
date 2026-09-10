---
status: accepted
---

# Use whole-dataset Gist sync for the proof of concept

Gist sync compares `dataUpdatedAt` timestamps and replaces the older dataset with the newer one, without merging individual cards. This was chosen for simplicity during the proof of concept, accepting that independent changes in the older dataset can be lost. Conflict resolution is a candidate for future refactoring; whole-dataset last-write-wins remains the current policy until a replacement is chosen.
