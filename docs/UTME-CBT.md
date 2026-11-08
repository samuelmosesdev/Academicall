# UTME CBT for aspirants (2026-10-18)

Aspirants practise JAMB UTME on a CBT screen built like the real one, in Academicall colours.

## Where it lives

| Route | What |
|---|---|
| `/dashboard/utme` | Setup page + recent sessions (sidebar item **UTME CBT** for aspirants; also a card on the aspirant dashboard) |
| `/utme/exam` | Full-screen exam room and the result/review screen |

## What a candidate can choose

1. **One subject** or **Full UTME** (Use of English is locked in, plus any 3 subjects).
2. **By topic** (pick one or many syllabus topics per subject, or all), **By year** (one past paper per subject, 1978–2026; the list shows how many questions each paper has), or **Mixed** (random across all years).
3. **40 per subject** or **JAMB standard** (English 60, other subjects 40).
4. **Timed CBT** (JAMB pace: 7,200 s for 180 questions, i.e. 40 s a question → 2 h for a full 4-subject paper; results at the end, auto-submits at 0:00) or **Practice** (no timer; picking an option locks it and shows the right answer and the explanation).

## Exam room

- Candidate strip (photo, name), subject tabs with answered counts, countdown (turns red under 5 minutes).
- Question sheet: passage panel for comprehension/literature sets, stem, options A–E, Flag.
- Number grid per subject (answered / not yet / flagged / current), progress bar, Submit with an "unanswered" warning.
- **Calculator**: the simple CBT calculator — digits, + − × ÷, √, %, ±, MC/MR/M+/M−, CE, C, backspace. Draggable on desktop, a bottom sheet on phones, keyboard input works.
- Keyboard like the JAMB centres: **A–E** answer, **N** next, **P** previous, **F** flag, **S** submit (also ← →).
- A refresh doesn't lose the session (kept in `sessionStorage`); leaving the room keeps it and the setup page offers **Continue**.
- Result: total out of 100 × subjects (out of 400 for a full UTME), per-subject bars, review filtered by Wrong / Skipped / Right / All with explanations. Where our review disagrees with the published JAMB key, the review says so.

## The question bank

Built from the uploaded **JAMB Topical Past Questions** zip. Its source README reports 36,383 questions; the 25 bundled subject files currently contain 35,285 question records, listed below. The topical books also carry each question's exam year, so one source gives both topic and year modes.

| Subject | Questions | Topics | Years |
|---|---:|---:|---:|
| Use of English | 4,729 | 11 | 49 |
| Biology | 2,591 | 20 | 48 |
| Economics | 2,531 | 23 | 47 |
| Chemistry | 2,500 | 20 | 48 |
| Geography | 2,494 | 14 | 46 |
| Christian Religious Studies | 2,484 | 24 | 46 |
| Physics | 2,470 | 39 | 47 |
| Government | 2,447 | 21 | 48 |
| Literature in English | 2,389 | 67 | 46 |
| Mathematics | 2,363 | 23 | 48 |
| Commerce | 1,710 | 21 | 31 |
| Principles of Accounts | 1,618 | 19 | 30 |
| Islamic Studies | 1,239 | 15 | 24 |
| History | 745 | 14 | 11 |
| Agricultural Science | 631 | 16 | 9 |
| Hausa, Home Economics | 400 each | 3 / 9 | 9 |
| Physical and Health Education | 333 | 12 | 4 |
| Computer Studies | 293 | 9 | 3 |
| Igbo | 285 | 3 | 7 |
| French | 261 | 5 | 4 |
| Fine Arts | 130 | 3 | 2 |
| Music | 83 | 5 | 2 |
| Arabic | 80 | 3 | 1 |
| Yoruba | 79 | 3 | 1 |

Files (static, served by Firebase Hosting with the app):

```
public/utme/index.json            subjects, topic counts, years, questions per year
public/utme/<subject>.json        topics, passages, questions (compact keys, see src/lib/utmeBank.js)
public/utme/img/<subject>/*.webp  pictures (~73 MB total)
```

**Pictures.** Plain-text questions are shown as text (sharp in light and dark mode). Anything the PDF typeset as maths, plus tables, diagrams and every Arabic question, is cropped straight from the book at high resolution — the stem and each option separately — so fractions, powers, roots, chemical formulae and diagrams look exactly as printed. Every picture that contains a diagram carries a light **academicall.site** watermark (corner stamp plus a faint diagonal repeat). Pictures sit on a white "paper" card so they read well in dark mode.

**Answer keys.** Where the books flag the official key as doubtful ("key check"), the app uses the corrected answer and the review notes the published key.

**Rebuilding the bank** (only if the source PDFs change): `work/cbt/parse.py` + `build.py` (PyMuPDF + Pillow) → copy `out/` to `public/utme/`.

## API

New table `utme_attempts` (migration `20261018090000_utme_cbt`) keeps each finished session so history follows the candidate across devices:

- `GET /api/v1/utme/attempts` — history + totals
- `POST /api/v1/utme/attempts` — save a finished session (mode, style, per-subject scores, config, compact answers)
- `GET /api/v1/utme/attempts/:id`, `DELETE /api/v1/utme/attempts/:id`

If the API can't be reached, the result still shows and the session is kept in local history on that device; the interface identifies device-only history. API validation and authorization errors are shown instead of being misreported as offline saves.

## News in dark mode

`src/dark-theme.css` (end of file) + a `news-page` class on `NewsShell`:
- masthead no longer shows a bright paper box — it's the dark app colour with a dark border;
- story text, sub-headings, quotes and summaries are lifted to readable light tones (was dark ink on dark);
- category pills, follow buttons, reactions, search suggestions and the sign-in fade all have dark versions.

## Deploy

1. API: `npx prisma migrate deploy` (adds `utme_attempts`), then restart.
2. Web: build and deploy as usual — `public/utme` ships with the site.
