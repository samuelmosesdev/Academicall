# 2026-10-31 — Staff workspace UX, quiet student refresh, and "Library" rename

## Student dashboard: quiet auto-refresh

Profile refreshes now keep the same user object when nothing changed, preventing dependent effects from reloading and flashing the dashboard. Background data refreshes avoid loading placeholders, pause while the tab is hidden, deduplicate requests, and only update changed data. Stale collection responses are ignored after an account switch, and refresh failures are logged while the last good data remains visible.

New posts fade in, reaction counts tolerate non-array values, and KPI values receive a soft highlight only when they change after initial load. Reduced-motion preferences are respected.

## "Materials" to "Library"

Student navigation, search, library pages, sharing text, and admin feature labels now use "Library". Routes, feature keys, and API paths are unchanged. "Materials" remains in Secretariat, Document Center, the Programme tab, and Downloads ("Materials on this device").

## Admin and agent workspaces

- Added shared staff navigation and workspace shell components, with grouped/collapsible navigation.
- Added dashboard greetings, attention queues, clickable KPI cards, and Staff HQ side cards.
- Added keyboard-enabled staff search with lazy-loaded results and admin-only notification badge.
- Registered the `/admin/mail` and `/agent/mail` routes and restyled the agent mail page.
- Corrected active navigation matching so `/admin/activity` does not match `/admin/activity-log`.

## Backend

Only admins and agents can view all payment claims; other roles can view only their own claims. Library labels and sharing notification titles are display-text changes only.

## Validation

- Frontend production build passed.
- API TypeScript build passed.
- Frontend lint passed with existing Fast Refresh warnings.
- Integration tests were not run.
- No new environment variables.
