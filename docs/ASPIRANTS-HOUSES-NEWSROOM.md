# Aspirants, Aspirant Houses, Dashboard Board & Newsroom

Delivered 16 Oct 2026. Base: the Academicall.zip uploaded 15 Oct 2026 (not the Android 1.0.x work).

## 1. Aspirants
- New role `aspirant` (people seeking admission). Sign-up page has "I'm a student / I'm an aspirant" (`/signup?type=aspirant` preselects it). `POST /auth/register` accepts `accountType: "aspirant"`.
- After email verification, aspirants land on **Aspirant setup** (`/complete-profile`): first choice (required), second choice (optional, max two, must differ), course wanted at each, UTME year/score, state of origin, phone. Google sign-ups pick "Seeking admission" on the same page.
- Data: `aspirations` (rank 1|2, institution, course, programId), `users.aspirantMeta` JSON.
- Aspirants see a reduced sidebar: Dashboard, Aspirant House, My choices, News, Practice/CBT, Vault, Notifications, Profile, Settings. Student-only routes (department, courses, materials, groups, reading hub, timetable…) redirect to `/dashboard/house`.
- **Aspirant dashboard**: carousel of posts House Leaders pinned, "Your choices" lemon card, house cards with unread counts, and news aimed at aspirants.
- `/dashboard/choices`: change choices (moves houses) and "I got admission" → becomes a student and goes through normal profile setup.

## 2. Aspirant Houses
- One house per institution (`aspirant_houses`), opened automatically when an aspirant picks the institution (admins can open one early).
- Members (`aspirant_house_members`): active | muted (read-only) | removed. Removal sticks even if the aspirant re-saves choices.
- Threads (`house_threads`) — **only House Leaders (and admins / houses.manage) start them**. Members reply (`house_replies`). Leaders can edit, pin, close replies, delete threads and delete any reply.
- Pinned threads show on every member's dashboard. New thread → notification to every member; pin → notification; reply → notification to the thread author.
- **Mentions**: leaders type `@` to pick a member; stored as `@[Name](user:<id>)`; mentioned members get a "mentioned you" notification. Members' mention tokens are flattened to plain text (they can't ping people).
- Real-time: `house.thread`, `house.reply`, `house.removed`, `notification` SSE events.

## 3. House Leaders
- Duty tag `houseLeader` (any student or agent; not aspirants). Assigned by admin (capability `users.houseLeader`, admin-only by default) on **Admin → Aspirant Houses** (pick a house, add leaders; adding a leader grants the duty) or the Duties card in Staff access.
- **House desk** (`/house-desk`): houses I lead → Threads tab (compose with @mentions, image, pin) and **Members** tab (search, choices, UTME details, replies count, Mention / Mute / Remove / Restore with reason). Linked from student and agent sidebars.

## 4. Admin: aspirants & houses
- `/admin/aspirants` (agents with `aspirants.view` / `aspirants.manage` at `/agent/aspirants`): stats, most-chosen first choices, filters (status, institution, search), table with both choices + UTME, drawer with full details, house memberships, edit choices, suspend/reactivate (signs out), delete.
- `/admin/houses` (`houses.manage` or `users.houseLeader`): house cards, leaders, edit name/motto/cover/rules, close/reopen, open a house early.

## 5. Student dashboard board
- The big left panel now shows only what admins / agents with **`board.manage`** curate at `/admin/board` (`/agent/board`):
  - **Message** slides (headline, text, button, colour theme, optional picture) and **Design only** slides (full-bleed image, no text, optional tap link).
  - Audience (students / aspirants / everyone), schedule (start / end), show/hide, reorder.
  - Settings: board background image, rotate on/off, seconds per slide, personal welcome slide on/off.
- The lemon box is narrower and is now **Lecture update**: next lecture with countdown, then the latest changes (added / updated classes in the last 4 days, with venue and notes).

## 6. Newsroom
- **Chief News Agent** = duty tag `newsChief` (admins only can assign; it includes the News duty). News desk gets tabs: My stories · Review queue · All stories · News Agents.
  - Approve / send back stories from restricted agents; take down (hidden), restore, unpublish, edit or delete any story (author notified with the reason).
  - Set each agent: Active · Require approval (restricted) · Suspended; remove from team. Suspended agents can't write; restricted agents' "Publish" becomes "Send for approval".
- **Search that suggests**: `GET /news/suggest` gives headline matches, word completions and "Did you mean…". Results are ranked (headline > tags > section > standfirst > body, plus recency), typo-tolerant and understand Nigerian synonyms (JAMB/UTME, bursary/scholarship, ASUU/strike, NELFUND/loans…). Optional quiet assist: set `GEMINI_API_KEY` (and optionally `NEWS_ASSIST_MODEL`, default `gemini-2.0-flash`) and, when few local results exist, related keywords are fetched in the background (1.5 s timeout, cached 24 h). Nothing in the UI says AI.
- **Subscriptions**: follow sections, topics (any word / tag), writers, institutions (`/news/following`, Follow buttons on news home, search results and articles). New matching stories → instant notification + SSE `news.new`; **For you** rail on the news home and on the aspirant dashboard.
- **Audience targeting** for publishers: groups (students / aspirants / staff), institutions (students there + aspirants who chose them), levels. Everyone still sees the story on the news page; the audience is notified first (opt-out switch "Stories picked for people like me"). Stories also take topic tags.

## API summary
Aspirant: `GET|PUT /aspirant/me`, `POST /aspirant/me/admitted`
Houses: `GET /houses`, `GET /houses/:id`, `POST /houses/:id/read`, `GET|POST /houses/:id/threads`, `GET|PATCH|DELETE /houses/:id/threads/:threadId`, `POST /houses/:id/threads/:threadId/replies`, `DELETE /houses/:id/replies/:replyId`, `GET /houses/:id/members`, `PATCH /houses/:id/members/:userId`
Admin: `GET /admin/aspirants`, `GET|PATCH /admin/aspirants/:id`, `GET|POST /admin/houses`, `PATCH /admin/houses/:id`, `GET /admin/houses/leader-candidates`, `POST /admin/houses/:id/leaders`, `DELETE /admin/houses/:id/leaders/:userId`
Board: `GET /board`, `GET /admin/board`, `POST /admin/board/slides`, `PATCH|DELETE /admin/board/slides/:id`, `POST /admin/board/reorder`, `PUT /admin/board/settings`
News: `GET /news/suggest`, `GET /news/for-you`, `GET|POST /news/subscriptions`, `PATCH /news/subscriptions/prefs`, `DELETE /news/subscriptions/:id`, `GET /news/chief/overview`, `GET /news/chief/posts`, `PATCH|DELETE /news/chief/posts/:id`, `GET /news/chief/agents`, `PATCH /news/chief/agents/:id`, `DELETE /news/chief/agents/:id/duty`. `GET /news?q=` now uses ranked search (pages with `offset`).

## New capabilities
`users.houseLeader`, `aspirants.view`, `aspirants.manage`, `houses.manage`, `board.manage` (none are Alpha Agent defaults except aspirants.view/manage; admins grant them per agent in Staff access).

## Database
Migration `20261016090000_aspirants_houses_board_news`: enum values `Role.aspirant`, `NotificationType.house|news`; user columns `aspirantMeta, newsStatus, newsStatusReason, newsStatusAt, newsAlerts`; news_posts `tags, audience, moderationNote, moderatedById, moderatedAt`; tables `aspirations, aspirant_houses, aspirant_house_members, aspirant_house_leaders, house_threads, house_replies, dashboard_slides, news_subscriptions`. Additive only; no data is changed.

## Tests
`Academicall-api/tests/integration.test.mjs`: 71/71 pass (17 new: aspirant sign-up/choices, Google-path conversion, house permissions, leader assignment, mentions, pinning, mute/remove, admin aspirants, board, chief approve/suspend/takedown, typo search, subscriptions, audience).
