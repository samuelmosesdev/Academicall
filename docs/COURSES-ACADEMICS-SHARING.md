# Courses, Academics admin, Users directory, share previews

Phase delivered 15 October 2026. It builds on the staff-access patch.

## 1. Course catalogue (national curricula)

**Where the data comes from:** `Nigerian_Institutions_Programme_Courses.docx` contains 367 programme course lists:
- NUC CCMAS 2022/23, with the older BMAS lists
- NBTE ND/HND
- NCCE NCE

**How it gets into the API:**
- `Academicall-api/scripts/build-curricula-data.py` turns the document into `prisma/data/curricula.json.gz`. To rebuild it:
  1. `pandoc Nigerian_Institutions_Programme_Courses.docx -t json -o /tmp/courses.json`
  2. `python3 scripts/build-curricula-data.py /tmp/courses.json`
- `src/lib/curriculumSeed.ts` loads that file. It runs:
  - automatically after the institutions seed when the server starts, or
  - by hand with `npm run db:seed:curricula` (add `--force` to re-link).

**What the seed creates:**
- 13,389 `Course` rows with `source = "catalogue"`, each keyed by `catalogKey` (`CODE|TITLE`).
- 367 `Curriculum` rows and 19,836 `CurriculumCourse` rows (level, semester, units, status, and a legacy flag for BMAS).
- `ProgramCurriculum` links, matched in this order:
  1. JAMB abbreviation plus programme name (26,121 programmes)
  2. The programme name alone, within the same tier
  3. The core name, so "Computer Science (B.Sc.)" matches "B.Sc. Computer Science"
- GNS, GSE and EDU are linked to every programme in their tier.
- 3,939 programmes have no published curriculum. They still get department courses, catalogue search and manual entry.

**Safe to re-run:** the seed only adds rows and is idempotent. It never edits rows an admin has changed.

**Not included:** the institution-specific handbook lists (Part D of the document) are only in the companion workbook, `Nigerian_Institutions_Programme_Courses.xlsx`, which hasn't been provided yet.

**Migration** `20261015090000_course_catalogue`:
- `Course` gains `units`, `catalogKey` and `archivedAt`.
- `Enrollment` gains `courseCode` and `source`, with a unique `(userId, courseCode)`. Existing rows are backfilled first, keeping the oldest row for each code.
- New tables: `curricula`, `curriculum_courses`, `program_curricula`, `department_courses`.

## 2. Student Courses page (`/dashboard/courses`)

**Where the list is stored:** the student's list is now saved on the server as `Enrollment` rows. Each change saves straight away; there is no Save button.

**Old lists carry over:** the old profile JSON (`customCourses`) is copied in once, the first time the student opens the page. The JSON itself is left untouched.

**What the page shows:**
- **Summary tiles:** how many courses are on the list (against the plan limit), total credit units, and how many suggestions there are.
- **My courses:** each course shows where it came from (Catalogue, Added by you, From your slip, Course Rep, or Retired), with a remove button that asks for confirmation.
- **Suggested for your programme:**
  - Grouped by level and semester.
  - Filters: search, My level / All / each level, and semester.
  - An "older curriculum" toggle.
  - Students tick several courses, then use "Add to my courses" in the bar at the bottom.
  - Courses already on the list show as "On your list" and can't be ticked.
- **Search the whole catalogue:** paginated, with an Add button on each result.
- **Add a course yourself:** a code and title, checked on the server.
- **Import from course form:** the existing document-import modal. Imported courses go through the bulk endpoint.

**Rules the server enforces:**
- No duplicates by course or by code. A duplicate returns 409.
- The free plan holds 5 courses (403 with code `limit`).
- Retired courses can't be added.

**Endpoints:**
- `GET /me/courses`
- `GET /me/courses/suggestions?legacy=1`
- `POST /me/courses` with `{ courseId }` or `{ code, title }`
- `POST /me/courses/bulk` with `{ courseIds | custom }`
- `DELETE /me/courses/:id`
- `GET /catalog/courses?q=&page=`

**Other pages that changed:**
- `GET /courses` (used by CBT and materials) now leaves out catalogue rows unless `?catalog=1`.
- The older `POST /enrollments` follows the same rules as `POST /me/courses`.
- The Timetable's course picker reads the student's own list (`useMyCourses`).

## 3. Academics admin (`/admin/academics`; `/agent/academics` with the new capability)

**Who can use it:**
- It needs the new `academics.manage` capability.
- Admins always have it. Agents only have it if an admin grants it in Staff access; Alpha Agents don't get it by default.
- Only an admin can delete permanently.

**Tabs:**
- **Overview:** live counts, plus an explanation of how suggestions reach students.
- **Institutions:**
  - Search; filter by type, ownership, state and status; sortable columns; pagination.
  - The detail drawer shows counts and an explorer: Faculties → Departments → a department's Programmes and Courses.
  - Add, rename, archive, restore and delete at every level.
  - Programmes: link or unlink a national curriculum.
  - Departments: assign an existing course or create a new one, with level, semester and Compulsory/Elective; unassign.
- **Courses:**
  - The whole catalogue: search; filter by tier, source and status; sortable; paginated.
  - The drawer shows the curricula and departments that use the course, and how many students have it.
  - Edit, archive, restore and delete.
  - "Bulk import" opens the existing spreadsheet/AI import page, now listed as "Course import" in the sidebar.
- **Curricula:** browse every list by tier, see its courses by level (current or older), and switch a list off or on.

**Safeguards:**
- Validation on the server (zod).
- Duplicate checks: names within a parent (case-insensitive), course code plus title, and institution abbreviation. Each returns 409 with the existing record's id.
- A department can only move to a faculty in the same institution.
- Delete is refused while students, groups, materials or child records depend on the record (409 `in_use`). The message says to archive instead.
- Archiving keeps all data.
- Renaming a faculty, department or programme updates the students' profiles in the same transaction.
- Changing a course's code or title updates the lists of students who have it.
- Every change is audited (`academics.*`).

## 4. Users directory (`/admin/users`, `/agent/users`)

- Search, filters and sorting run on the server and results are paginated. You switch to this mode by passing `page`; calls without it get the old response.
- **Group chips with counts:** Students, Course Reps, News, Secretaries, Agents, Admins, Everyone.
- **Search:** name, email, Academicall ID or matric number.
- **Filters:** department, level, plan and status.
- **Sortable columns:** Person, Level, Last active, Joined.
- **Each row shows:** role, duty and plan chips; institution and department; status (with an icon if they must change their password); last active; joined.
- **Quick suspend or reactivate:** needs `users.suspend` and only works on people of lower rank. It asks for confirmation first.
- Clicking a row opens the full profile (`AdminUserDetail`), where the sensitive actions already sit behind their own permissions.
- "Export this page" downloads a CSV.

## 5. Vault access

- `POST /files/vault-files/:id/open` no longer notifies the student.
- Opening still needs `vault.recover` (admins only) and a written reason.
- The open is audited as `vault.open`, with the admin, the time, the file id, the reason and the IP.
- Browsing a student's vault listing is now audited as `vault.browse`.
- Restoring a file still tells the student it is back, because that helps them.
- Document Center's wording says the reason is written to the audit log.

## 6. Share previews

**Why a function is needed:** WhatsApp, X, Facebook, LinkedIn, Telegram and Slack never run the app's JavaScript.

**How it works:**
- Firebase Hosting sends `/news`, `/news/**`, `/study/**` and `/og/**` to the **ogPage** function (`functions/ogPage.js`, firebase-functions v2). See `firebase.json`.
- The function asks the API for `GET /og/meta?path=…`.
- It writes the title, description, canonical, `og:*`, `twitter:*` and `article:*` tags between `<!-- og:start -->` and `<!-- og:end -->` in `index.html`.
- It passes card images through from the API with a 7-day CDN cache.
- If the API takes longer than 3.5 s, the page still loads with the default tags.
- `public/og/default.jpg` and `default-news.jpg` are static files, so the default cards never depend on the API.

**Cards:** the API (`og.controller.ts`, using satori, resvg and sharp) draws 1200×630 JPEG cards, 40–110 KB each:
- **News:** cover photo, category, author, date, headline, excerpt.
- **Study-group invite:** icon, name, member count, course and level.
- Card URLs carry `?v=<updatedAt>`, so editing a story refreshes its preview.

**What stays private:**
- Drafts are never described.
- A department- or course-scoped group shows only its name and size, not its description.
- Group conversation pages (`/dashboard/groups/*`) and every `/dashboard`, `/admin`, `/agent` and `/secretariat` page get a generic "Sign in" preview.

**In the app:**
- The Share button on stories opens the phone's share sheet. On desktop it shows a menu: WhatsApp, X, Facebook, LinkedIn, Telegram, Copy link.
- `usePageMeta` keeps the tab title and canonical link in step with the story being read.

**Deploying:**
- `cd functions && npm install && cd .. && firebase deploy --only functions:ogPage,hosting`
- Optional `functions/.env`: `OG_API_URL=https://academicall-api-1.onrender.com/api/v1`
- The API needs `PUBLIC_SITE_URL=https://academicall.site` (that's the default) and new packages: `satori`, `@resvg/resvg-js` and `sharp`. They're already in `package.json`, and the Docker image copies `assets/og`.
- After deploying, check a link in https://developers.facebook.com/tools/debug/. WhatsApp caches previews per URL for about a week, so a link shared before the deploy can keep its old preview.

## 7. Design clean-up

- Sparkle icons were removed everywhere. Where the icon did a job it was replaced with one that says what the button does: a document scan for imports, a checklist for quiz generation, a crown for plans. Purely decorative ones were removed.
- Decorative glows, blurred blobs, a shine sweep and purple gradients were removed from the auth background, KPI cards, the subscribe gate, Upgrade, the admin and agent dashboards, and news articles. Photo scrims that keep text readable were kept.
- New shared pieces: `SearchField`, `SortTh`, `Pager`, `Drawer`, `Field`, `SkeletonRows` (`components/ui/DataBits.jsx`); `acx-table`, `acx-select`, `acx-drawer`, `acx-course` and `acx-callout` styles; `FormModal`.
- The Activity log showed "System" for every API action. It now shows who did it.
- No native `alert`, `confirm` or `prompt` calls remain.
