# Architecture

LeetSRS runs as a WXT browser extension with three runtime owners and shared contracts.

## Responsibilities and boundaries

- **Background** initializes storage, validates incoming commands, applies learning changes and FSRS scheduling, and owns backup import, reset, GitHub Gist access, sync, and badge updates.
- **Popup** presents the review queue, cards, notes, statistics, and settings. Its query layer reads validated storage and refreshes cached views on storage changes and as time passes.
- **Content** integrates with LeetCode pages: it reads problem context, injects review controls, and manages editor reset behavior. Its UI uses shadow roots; page navigation and DOM replacement require subscriptions and mounted UI to follow the content-script lifecycle.

Popup and content send typed background messages for persisted changes. Runtime owners depend on shared contracts rather than importing each other. Shared models, validation, storage access, and review/calendar calculations are independent of runtime owners and UI; shared presentation helpers are separate. Biome enforces these import boundaries.

## State and coordination

Cards, notes, scheduling state, review activity, and settings overrides form one validated local learning document. Learning operations compute related changes before replacing that document, so a review publishes its card and review activity together. Commands wait for background initialization; shared reads coordinate with that readiness when data is not ready. Message payloads and stored documents are validated at their boundaries.

Queue selection is shared by popup and badge work. Review activity retains only the latest review date, its new-card count, and its streak length. Legacy daily statistics are reduced to that latest day during installation and backup conversion. The new-card allowance and streak display use local calendar dates, so date boundaries affect both views.

Gist sync compares document edit timestamps and replaces the entire older document; it does not merge individual records. Credentials and connection settings live separately in browser sync storage, and local sync status does not change the document's edit timestamp. Startup, local edits, connection changes, and alarms trigger sync. Overlapping sync calls share an attempt; import, reset, and connection changes invalidate stale attempts. Local queries and mutations remain usable offline. Local saves complete independently of network sync, whose failures are exposed through sync status.
