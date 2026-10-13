# Real-time Programme hub, Study Groups, multi-institution support

_Added 2026-10-13. Backend: `Academicall-api/`. Frontend: `src/`._

> The deployed backend is **Academicall-api** (Render `academicall-api-1`). The root
> `src/*.ts` + root `prisma/` are an older duplicate and were not changed.
>
> This integration is currently in the worktree and is **not deployed**. The new
> Prisma migration has not been applied; deploy only after the migration target and
> production rollout are explicitly approved.

## 1. Real-time

**Mechanism:** Server-Sent Events. `GET /api/v1/realtime/stream` (JWT in the
`Authorization` header — the client streams with `fetch`, so no token in URLs/logs).
Writes stay on the normal REST endpoints; the stream only pushes. Heartbeat every
25 s, client watchdog + exponential back-off, and a `reconnected` event triggers a
catch-up fetch for programme content and groups. If the stream remains unavailable
while the browser is online, the client emits a 30-second `poll` catch-up event to the
open programme and group views.

| Event | Who receives it |
|---|---|
| `programme.post`, `programme.class`, `programme.material` | users whose institution + programme match |
| `group.message`, `group.message.deleted`, `group.updated`, `group.member` | active group members |
| `group.request` | creator + moderators (join / history requests) |
| `group.history`, `group.removed` | the affected member |
| `notification` | invited students |

Fan-out is in-process (`src/lib/realtime.ts`). If you run **more than one API
instance**, add Redis pub/sub or Postgres LISTEN/NOTIFY and call the same publish
functions from the subscriber.

Programme hub comments/reactions now use append endpoints inside a row lock
(`POST /feed/:kind/:id/comments`, `/reactions`, same for `/class-events/:id`), so
simultaneous comments are never lost. Old app builds that PATCH whole arrays still work.

## 2. Shared dialogs & toasts

`src/components/ui/DialogProvider.jsx` (mounted in `main.jsx`) + `src/lib/dialogs.js`:
provide `appAlert`, `appConfirm`, `appPrompt`, and `notify.success|error|info`. Group
workflows use the shared confirm and toast UI; existing unrelated native alerts have
not been bulk-replaced. Dialogs use the existing accessible `Modal`, with live-region
toasts for status messages.

## 3. Study groups

Routes: `/dashboard/groups`, `/dashboard/groups/:groupId`, invite link `/study/:code`
(survives sign-in / sign-up / profile setup), join screen `/dashboard/groups/join/:code`.

* Code: 8-char base62 from `crypto.randomBytes` (rejection sampling), unique index + retry.
* Max 200 members (row-locked check), max 3 moderators, approval toggle.
* Roles enforced server-side: creator (everything), moderator (approve joins/history,
  remove members, delete messages), member. Platform roles grant nothing in a group.
* A link alone shows only name/icon/description/member count — never messages or members.
* New members see messages from `joinedAt`. They can request history; when approved
  they get earlier text and files ≤ 2 MB; larger attachments come back as
  `withheld` with no URL (enforced in `messageView`, also for "save to Materials").
* Messages: text, photos (compressed client-side), short videos (≤ 3 min), documents.
  Cursor pagination (`before` + `beforeId`, 40/page), idempotent retries via `clientId`,
  upload progress / cancel / retry, unread counts, read markers, soft delete.
* **File validation (server):** URL must be on your Cloudinary cloud
  (`CLOUDINARY_CLOUD_NAME`), real size from `HEAD`, first bytes must match a PDF /
  Office / JPEG / PNG / GIF / WebP / MP4 / WebM signature. Renamed executables and HTML
  are rejected. Limits: image 10 MB, video 25 MB, document 20 MB (env-configurable).
* Course reps: "Class group" option; scope (programme+level, course, department,
  faculty) is taken from their own `courseRepMeta`, never from the request. Only
  eligible students can join; "Invite my whole class" notifies eligible students
  (rate-limited to once per 6 h). Reps have no power over other groups.

Tables: `study_groups`, `study_group_members`, `study_group_messages`.

## 4. Institutions

Hierarchy tables: `institutions → faculties → academic_departments → programs`.
Data: `Academicall-api/prisma/data/institutions.json.gz`, built from the JAMB IBASS
workbook by `scripts/build-institutions-data.py` (deterministic ids, idempotent seed on
boot or `npm run db:seed:institutions`). Full mapping + every exclusion:
`Academicall-api/docs/INSTITUTIONS-IMPORT-REPORT.md`.

* 1,634 institutions, 4,007 faculty groups, 30,207 programmes.
* **The source has no departments.** Each programme is filed under a department of the
  same name with `derived = true`; the picker explains this to students.
* The "faculty" level is the IBASS group (e.g. SCIENCES, NCE programmes).
* Excluded: 7 DEMO rows, 9 programme rows with no name. Merged: 9 duplicate institution
  rows, 661 duplicate programme rows. 72 institutions have no programmes (selectable, with
  a "request" button).
* University of Abuja keeps id `uofa` and its curated catalog; the admin catalog editor
  syncs into the tables. Migration links every existing user, feed post, class,
  membership and document to `uofa`. 46 UofA programmes listed in IBASS but not in the curated
  catalog were reported, not added.
* Feed, class events, memberships, Course Rep lookups, documents/materials and groups
  are scoped by institution. Department membership uniqueness includes institution,
  preventing same-named programs from colliding across schools.

Public endpoints: `GET /institutions?q=`, `/institutions/:id`, `/institutions/:id/tree`.
Admin: `POST /institutions`, `/institutions/:id/faculties`, `/faculties/:id/departments`,
`/academic-departments/:id/programs`. `PATCH /users/me` accepts
`institutionId/facultyId/departmentId/programId` and checks each belongs to its parent.

## Security fixes made along the way

* Students could change their own `courseRepMeta` through `PATCH /users/me` — now staff-only.
* Creating class events now requires course rep or staff.
* `GET /auth/me` now returns `program` / `courseRepMeta` (the Programme hub lost them on reload).

## Tests

* `cd Academicall-api && npm run build && npm run test:integration` — end-to-end API
  tests against PostgreSQL. Set `DATABASE_URL` to a dedicated, isolated test database;
  the tests create and delete rows and must not be run against production.
