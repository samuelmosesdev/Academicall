# Staff & student gaps release (2026-10-18)

Applies on top of **utme-control-room-and-features.patch** (after utme-cbt and cbt-paper-look).

## Install

1. `git apply staff-student-gaps.patch` (or copy `changed-files/`).
2. Web app: `npm install` (adds `@capacitor/push-notifications` and `qrcode`).
3. API: `cd Academicall-api && npx prisma migrate deploy && npx prisma generate && npm run build`.
   Migration: `20261018150000_staff_student_gaps` (new tables, new user columns, three notification types; existing notifications are marked as already pushed).
4. Android: `npx cap sync android` (registers the push plugin; `POST_NOTIFICATIONS` permission added to the manifest).

## New environment variables (API)

| Variable | Needed for | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Push notifications | Service-account JSON from Firebase console → Project settings → Service accounts → Generate key (project **uofa-reader**). Paste the JSON or its base64. Without it push stays off and everything else works. |
| `TWO_FACTOR_KEY` | Optional | Encrypts authenticator secrets. Defaults to a key derived from `JWT_SECRET`. Set it once and never change it (changing it breaks existing authenticator set-ups). |
| `BACKUP_REPORT_TOKEN` | Backup status | Shared secret for `scripts/backup.sh` → `POST /admin/backups/report`. |
| `BACKUP_DIR` | Optional | Lets "Back up now" run `pg_dump` on the API host. Most hosts (Render) don't ship `pg_dump`; use the script on a server or GitHub Action instead. |

**Android push also needs** `android/app/google-services.json` (Firebase console → Project settings → Your apps → Android app `com.uofa.readers` → download). The Gradle file already applies the Google services plugin when that file exists.

**Web push also needs** the matching web app configuration (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`) and the Web Push certificate key (`VITE_FIREBASE_VAPID_KEY`, Firebase console → Project settings → Cloud Messaging → Web Push certificates) in the frontend build environment. Set the same values for local builds and the hosting provider. The service worker is generated from these values, so it always uses the same Firebase project as the web app. Never add the API service-account JSON to frontend variables.

## What's in it

### Staff side
1. **Moderation queue** — `/admin/moderation`, `/agent/moderation` (capability `moderation.manage`; agents and alpha agents get it by default). Reports from group messages, house threads/replies, news comments, programme posts and people. Hide / hide + warn / hide + mute (1–30 days) / dismiss. One action closes every open report on the same content; reporter and author are notified; everything is in the audit log. Muted people can read but can't post, comment or reply (enforced in the API). A "Muted people" tab lifts mutes.
2. **UTME question reports + statistics** — candidates tap **Report** on a question in review. Control room gets **Reports** (grouped by question: reasons, notes, Open → jumps to the question, Fixed notifies reporters, Dismiss) and **Insights** (accuracy per subject, most-missed questions with miss rate — a very high miss rate usually means a wrong key).
3. **Two-step sign-in + sign-in history** — any account can turn on an authenticator app (QR code, 8 backup codes) or email codes. `/admin/security`: require it for all staff (the admin must have it on first, so nobody locks themselves out), staff coverage, every staff sign-in with failures highlighted. Staff without it are sent to `/security-setup` and the API answers only set-up calls until it's on. Every sign-in creates a device session; people can sign devices out from Settings, staff from the user's page. User page also shows sign-in history and **Reset two-step sign-in** (signs them out everywhere).
4. **Maintenance mode + site banner** — on `/admin/features`. Maintenance: everyone but staff gets a "Back soon" screen and the API answers 503 `maintenance` (sign-in still works so staff can get in); optional end time switches it off by itself. Banner: text, tone, optional link, audience (everyone / students / aspirants), optional end time; people can dismiss it.
5. **Features by audience** — each feature is On / Limited / Off. Limited = only students and/or aspirants, chosen institutions, or beta testers (combine: "Students + UNILAG" = UNILAG students). Beta testers are managed on the same page and on each user's page.
6. **Data requests + backups** — `/admin/data`: every self-service download, deletion requests from people who can't delete themselves (mark done / decline with a note they see), export any account (reason required, logged). Backup status: health (ok ≤ 26 h, late, overdue), last runs, sizes; failures notify admins.

### Student side
1. **Offline** — `/dashboard/downloads`: materials saved on the phone, **Download folder** on every materials folder (Android), UTME subject packs on the website (questions + pictures + control-room fixes in Cache Storage; the service worker serves them offline; the Android app already contains the whole bank). UTME sessions finished offline queue and sync when back online. **Data saver** switch (Settings → Your data, and on Downloads).
2. **CGPA & results** — `/dashboard/results`: semester-by-semester grades with units, GPA, running CGPA, class of degree (5.0 or 4.0 scale), "Use my courses" to fill a semester, and **Reach a target** (the average you need over the units left).
3. **UTME coaching** — UTME CBT → **Progress**: today's questions vs your daily target, streak, sessions, days to the exam, weakest topics with **Drill this** (sets up a practice drill on that topic), and each subject's last 12 scores with topic accuracy. Topic data is recorded from now on.
4. **Push notifications** — every in-app notification is also pushed to the person's phones (dispatcher reads new notification rows every 5 s, so all existing features push without changes). Settings → Phone notifications: on/off, per category (classes, announcements, groups, house, news, tests, account), quiet hours (Lagos time). Security notices always go through. Sign-out removes the phone's token.
5. **Report / block, privacy, devices, 2FA** — ⋯ on a group message → Report / Block sender; flag button on house threads, replies and news comments. Blocked people's content is hidden; unblock in Settings → Privacy. Privacy: who sees my profile, department/level, courses, phone. Settings also has Two-step sign-in, Where you're signed in (+ recent sign-ins) and Your data (download / request deletion).
6. **Global search** — the top-bar search now works: pages, courses (yours and the catalogue), approved materials, your study groups, news and UTME subjects; Enter opens `/dashboard/search`. A search button replaces it on phones.

### General tests (new)
`/admin/tests`, `/agent/tests` (capability `tests.manage`, agents by default). Students and aspirants see them at `/dashboard/tests` and sit them full-screen at `/test/:id`.
- **Questions**: any number of sections; each section can pull random questions from a UTME subject (filter by topics and year, add N at a time, preview, remove) and/or questions you write (2–5 options, answer, explanation). So: one subject, several subjects, or a mix.
- **Audience**: students (institution → faculty → department → programme, levels), aspirants (Aspirant House, institution of choice, UTME year), plan, plus named people — or only named people. Live "N people match".
- **Timing**: time allowed, optional opening and closing times (Lagos), attempts per person, shuffle (within sections; passages stay together).
- **Fair marking**: the question set is frozen with its answers on the server; candidates receive questions without answers, the server holds the clock and marks the paper. Answers autosave every 20 s and are kept on the device if the connection drops; late submissions count the last autosave.
- **Results**: straight away, after closing, or staff only. Staff see rank, score, section scores, time taken, the hardest questions, and download a CSV. Closing a test submits anyone still sitting it. Questions lock once someone starts.
- Publishing notifies the audience (and pushes to their phones).

## New feature switches
`results` (CGPA), `downloads`, `tests`, `search` — all on by default.

## Backups and a restore drill
`Academicall-api/scripts/backup.sh` (pg_dump → keep 14 → optional `rclone` copy → reports to the API). Cron at 02:30 Lagos: `30 1 * * *`.
Restore drill once a term: `createdb academicall_drill && pg_restore --no-owner -d academicall_drill <latest>.dump`, point a local API at it and sign in.

## Tests
- `work/gap/smoke.mjs` — 82 checks across 2FA, sessions, staff requirement, limited features, maintenance, banner, moderation + mute, UTME reports/insights, CGPA, push prefs, privacy, data export, search, general tests (audience, hidden answers, server marking, CSV, locking).
- Existing integration suite: 71/71.
