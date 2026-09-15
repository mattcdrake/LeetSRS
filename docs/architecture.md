# Architecture

LeetSRS runs as a WXT browser extension with three runtime owners and shared contracts.

## Responsibilities and boundaries

- **Background** initializes storage, validates incoming commands, applies learning changes and FSRS scheduling, and owns backup import, reset, GitHub Gist access, sync, and badge updates.
- **Popup** presents the review queue, cards, notes, statistics, and settings. Its query layer reads validated storage and refreshes cached views on storage changes and as time passes.
- **Content** integrates with LeetCode pages: it reads problem context, injects review controls, and manages editor reset behavior. Its UI uses shadow roots; page navigation and DOM replacement require subscriptions and mounted UI to follow the content-script lifecycle.

Popup and content call a typed background proxy service for persisted changes. Runtime owners depend on shared contracts rather than importing each other. Shared models, validation, storage access, and review/calendar calculations are independent of runtime owners and UI; shared presentation helpers are separate. Biome enforces these import boundaries.

## State and coordination

The bundled problem catalog is a separate, rebuildable IndexedDB database, outside learning data, backup, and sync. Background startup compares the bundled hash with the stored hash and atomically replaces catalog records and the hash when they differ. One background readiness promise initializes the catalog first, then learning storage. Commands, alarms, sync, and badge updates wait for both; initialization failure rejects commands and prevents background work until a successful startup. Shared catalog lookups use the frontend ID or unique slug index and return a problem only for a domain listed in its sources. Direct IndexedDB access requires an extension-origin context. Content reads the slug from the current URL and requests a domain-aware catalog lookup through the background service; unknown problems are errors. Popup queries join card records with catalog details for display and problem links.

Cards, notes, scheduling state, review activity, and settings overrides form one validated local learning document. Cards are keyed by string frontend ID, shared across LeetCode domains, and retain only that ID, the original domain, creation time, scheduling state, pause status, and note. Problem metadata stays in the catalog. Installation, backup import, and sync use the same versioned conversion to rekey legacy cards by their LeetCode ID and discard invalid cards. Learning operations compute related changes before replacing that document, so a review publishes its card and review activity together. Commands wait for background initialization; shared reads coordinate with that readiness when data is not ready. The service interface and typed key live in shared; its implementation stays in background and registers synchronously at startup. One command wrapper awaits readiness and validates positional arguments with Zod before execution. Stored documents are validated at their boundaries.

Queue selection is shared by popup and badge work. Review activity retains only the latest review date, its new-card count, and its streak length. Legacy daily statistics are reduced to that latest day during installation and backup conversion. The new-card allowance and streak display use local calendar dates, so date boundaries affect both views.

Gist sync compares document edit timestamps and replaces the entire older document; it does not merge individual records. Credentials and connection settings live separately in local browser storage, and local sync status does not change the document's edit timestamp. Startup, local edits, connection changes, and alarms trigger sync. Overlapping sync calls share an attempt; import, reset, and connection changes invalidate stale attempts. Local queries and mutations remain usable offline. Local saves complete independently of network sync, whose failures are exposed through sync status.

## GitHub authorization

Background owns GitHub OAuth, account validation, refresh, and sign-out. An explicit UI action starts Chrome's web auth flow with state and PKCE; the background promise outlives the popup. Sign-in state is memory-only, so a browser restart requires retry. The UI reads credential-free authorization status. Changing accounts requires signing out first. Signing in never enables sync: the user selects an owned backup or creates one, then connects. Existing backups are validated with the normal versioned conversions before replacing a connection, including full downloads for truncated files.

The stateless Cloudflare Worker in `backend/` handles only token exchange and refresh at `auth.leetsrs.com`; it keeps the client secret in Cloudflare Secrets, validates requests, and applies rate limits. Credentials pass through without persistence, caching, or logging. The extension accesses Gists directly. There is no hosted learning data or application database.

Concurrent refreshes share a promise. A session counter rejects stale network results after sign-out. Sign-out waits for storage writes already in progress before removing credentials and the connection; refresh persists rotated tokens before returning them. Startup retires synced PAT storage before any sync, preserves a previous Gist suggestion, and records a dismissible migration notice. Retired connections never become authoritative again.
