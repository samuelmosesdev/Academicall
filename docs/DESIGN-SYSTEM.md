# Academicall — "Ink & Lemon" design system

Built on Moses's palette, kept calm, spacious and classic.

| Colour | Hex | Role |
|---|---|---|
| Midnight Violet | #0F0326 | ink text, primary buttons, sidebar, dark panels |
| Violet Twilight | #454ADE | links, focus, secondary actions (`teal` / `accent` tokens now map here) |
| Bright Lemon | #F8F32B | "now" moments: next class, Pro, unread badges, highlights |
| Aquamarine | #44FFD1 | success, streaks, live dots (`aqua-deep` #0A9A78 for text on light) |
| Paper (added) | #FBF9F4 | page canvas |
| Sand (added) | #F3EFE6 | quiet surfaces |
| Soft tints (added) | lemon-soft #FCF9C4 · aqua-soft #D9FFF4 · violet-soft #E9E9FC | large cards |

Dark mode is a midnight-violet night theme. The `dark:` variant now follows the in-app toggle (`html.dark`), not only the phone's OS setting.

## Type (self-hosted via @fontsource, so it works offline in the Android app)
- **Fraunces**: classic serif for headlines and page titles (`font-display`). Light weights (350–450).
- **Fraunces italic**: `className="serif-i"` for one emphasised word per headline.
- **Geist**: all UI text (`font-sans`).
- **Geist Mono**: small uppercase labels (`className="eyebrow"`).

## What was redesigned
- **Landing**: rebuilt from scratch with a centred hero, a product composition over campus photography, role cards, two feature stories, an FAQ, the app band and the footer.
- **Auth**: Login, Signup, Forgot and Reset all use the new `AuthShell`, a split screen with photography and a lemon ticket.
- **Shell**: midnight sidebars for students, admins and agents (`.sidebar-ink`), plus sticky paper topbars with one row on phones.
- **Dashboard**: `DashboardHero` with a greeting and a next-class ticket, and calmer stat tiles (`StudentKpiCard`, `KpiCard`).
- **Modals**: `Modal` is a bottom sheet on phones and a centred card on desktop. `ConfirmModal` has pill buttons. Every hand-built overlay gets the same radius, shadow and entrance.
- **Global clean-up**: rainbow gradients, coloured left-border stripes and off-palette badge colours removed. Primary buttons are pills. Page titles get editorial scale automatically.

## Fixes found while testing
- On phones, modals opened from inside user pages (for example the profile change request) appeared off-screen, because the page-entrance animation used a transform. The animation is now opacity-only.
- `AiGenerateFromDocumentModal.jsx` line 1 read `port {` instead of `import {`, which was the only lint error.

## Photography
The photos in `public/images/campus/*.webp` were generated for Academicall, so there are no stock licences or watermarks. To swap in real campus photos, keep the same filenames.
