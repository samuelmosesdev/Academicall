# Firmness pass (2026-10-17)

Goal: make the web app feel solid and planted (like full Facebook), not light and jittery (like Facebook Lite). Ink & Lemon is kept.

## What changed
- **Canvas vs cards**: app background is now sand `#F2EFE7` so white cards stand out clearly (was cream `#FBF9F4`, nearly the same as white).
- **Edges**: `--color-border-subtle/light` `#E9E4DA → #D8D0C0`, `--color-border-strong` `#D6CFC2 → #BFB5A2`. Dark mode borders `#291E48 → #33275A`, `#3A2D62 → #46387A`.
- **Shadows**: one real card shadow (`0 1px 3px` at 8%) and a tight hover shadow, with no floating lift.
- **Text contrast**: muted `#7B7490 → #645D79`, secondary `#433B5A → #352C4D`.
- **Type**: no 10–11px text. `text-[10px]` becomes `0.7rem`, `text-[11px]` becomes `text-xs`. Eyebrow labels go from 0.68rem/500 to 0.72rem/600. Serif headlines go from weight 450 with SOFT 30 to weight 520 with SOFT 0 (crisper letterforms).
- **Corners**: cards use 1–1.25rem instead of 1.4–2rem (`--radius-xl` 1rem, `--radius-2xl` 1.125rem, `--radius-3xl` 1.25rem). Pills stay for chips and buttons.
- **Motion**: removed hover lifts and zooms (cards, folders, file sheets, vault tiles, news images, house threads, reactions) and replaced `transition: all` / `transition-all` with colour-only transitions. Press feedback on buttons is kept.
- **Top bar**: solid white with a hairline and a soft shadow, with no translucent blur.
- **Loading**: new `components/ui/Skeleton.jsx` (`Skel`, `SkeletonCards`, `SkeletonPage`). `LoadingState` now shows a skeleton the size of the page. House, threads, members, houses admin, news article, dashboard feed and notifications use skeleton cards instead of spinner text. House member tab counts stay hidden until the data arrives, so no "0" flashes.

## Deliberately untouched
- The dashboard board slides: `components/board/DashboardBoard.jsx`, `pages/AdminBoard.jsx`, and the `.board*` CSS. A scoped `.board { … }` reset in `index.css` keeps the board's radii, headline and eyebrow styling exactly as they were.
