# Kemtit UX Redesign — External Calendar Sync Rules

## Ownership boundary

Kemtit Calendar is the core calendar. Google Calendar and Outlook are optional external providers.

Kemtit owns:

- internal Calendar Events, Tasks and recurring occurrences, Time Blocks, Bills, and daily availability
- stable app-side source records for imported provider events
- day-level `calendar_events` projections used by Calendar, Today, Planner, and Rescue
- durable outbound operation identity and recovery state

Provider adapters own OAuth, token exchange and refresh, provider account/calendar identity, provider event identity and ETags, pagination, and provider-specific HTTP behavior. Calendar core must not depend on provider SDK types or credentials.

Provider tokens are encrypted with AES-256-GCM before persistence in the server-only credentials table. Authenticated client sessions cannot read credentials. When a provider omits a replacement refresh token or granted scopes, reconnect and refresh preserve the previously stored values. Write capability comes from the provider's granted scopes; a connection without write permission can still import events.

## Direction and mutation policy

Google and Outlook events are imported into stable source records and projected into `calendar_events` with `data_origin=IMPORT`. Internal Kemtit Tasks, Bills, Goals, and user-authored Calendar Events are not automatically exported.

The Events manager can create an event in an explicitly selected writable provider connection. It can update or delete an imported event only when the connection is active and writable, the source has an ETag, and the event is a single event or occurrence. Series edits are not offered. Updates are limited to title, date/time, all-day status, and busy/free status. Provider writes use a durable operation UUID, expected source revision, and provider ETag; a stale revision or provider conflict must be shown to the user. An ambiguous write is reconciled by reading provider state and is never blindly replayed.

## External event identity and projections

Each provider event has one stable app-owned source UUID, separate from the provider's event ID and separate from its daily projection rows. Repeated sync updates the same source and projections rather than creating duplicates. Full provider titles and canonical event values are kept on the source; the display projection may trim or cap a title without changing the value later sent to the provider.

Sync requests a bounded snapshot from 365 days before through 365 days after the current time. It reads and validates every page and builds all day projections before one transactional reconciliation. The implementation caps both source events and generated projections at 20,000. If fetching, validation, or projection fails, no partial snapshot is applied. Imported sources outside the requested window and USER-created events are preserved. A lease prevents an older sync or write from applying after a newer claim.

Timed events are split at midnight in the Kemtit application timezone, Asia/Bangkok. All-day provider end dates are exclusive and are projected only onto dates before that end. Imported events with `blocks_time=false` remain visible but do not consume daily availability.

## OAuth and environment

Provider configuration is server-only:

- Google: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`
- Outlook: `OUTLOOK_CALENDAR_CLIENT_ID`, `OUTLOOK_CALENDAR_CLIENT_SECRET`, `OUTLOOK_CALENDAR_REDIRECT_URI`
- Both providers: `CALENDAR_TOKEN_ENCRYPTION_KEY`

OAuth state and PKCE verifier are short-lived, HttpOnly, SameSite=Lax cookies and must match the callback. Users may skip or cancel OAuth without blocking core Kemtit workflows.

## Sync entry points and runtime

Sync is available after OAuth, manually from Settings, and through the authenticated endpoint `/api/cron/sync-google-calendars`. The legacy URL is retained and dispatches both Google and Outlook connections. Each cron request processes a small bounded batch; the repository does not configure a production calendar schedule. After deployment, an external scheduler must be configured to call the authenticated endpoint. The endpoint alone does not enable automatic sync.

## Disconnect

Disconnect removes that connection's encrypted credentials, provider-owned source records, and IMPORT projections. It preserves USER-created Calendar Events and the safe operation ledger needed to explain prior outbound results. It does not cascade into Tasks, Goals, or other Kemtit records.

## Failure behavior

Provider failures update safe connection sync metadata and do not block core Kemtit workflows. Failed or stale snapshots cannot partially rewrite imported events. Outbound operations retain queued, pending, unknown, conflict, or terminal results for explicit recovery; the UI must distinguish work not yet dispatched from a write whose provider outcome is uncertain. Logs must not contain access tokens, refresh tokens, provider payloads, ETags, or personal event contents.
