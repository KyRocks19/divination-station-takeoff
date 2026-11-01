---
name: accessibility-pass
description: Checklist for keyboard, focus, ARIA, touch and screen-reader behaviour of new or changed interactive UI. Use after building UI, before calling it done.
---

# Accessibility pass

The user's audience includes neurodivergent people; readable defaults and calm, predictable behaviour matter. Touch and screen readers have **never been checked** in this project, so say plainly which of these you could and could not do.

## What to check (you can do these with Playwright or the browser pane)
- **Tab order** follows the visual order; every control is reachable and shows a visible focus ring. Nothing focusable is hidden off-screen (a closed drawer must not be tabbable: `inert`, `hidden`, or `display: none`).
- **Current page**: the link for the page you are on has `aria-current="page"`.
- **Landmarks**: one `<main>`, navigation in `<nav aria-label="...">` (give each nav a distinct label), headings in order, a skip link where the nav is long.
- **Buttons vs links**: links go places, buttons do things. A menu button has `aria-expanded` and `aria-controls`.
- **Drawers, popovers, dialogs**: open on press; close on Escape, on an outside press, and when a link inside is chosen; focus moves in on open and **returns to the opening button** on close. Two popovers (for example the Tools picker inside a drawer) must not fight each other.
- **Forms**: every input has a visible label (`Field`), errors are text (not colour alone) and tied to the input with `aria-describedby`.
- **Images and art**: the person's own description is used as alt text; decorative icons are `aria-hidden`.
- **Motion**: honour `prefers-reduced-motion`.
- **Contrast** in at least two themes; text still readable at 200% zoom with no sideways scroll.
- **Touch targets** at least 44 px tall on phone widths; respect `env(safe-area-inset-*)` for fixed bars and drawers.
- **Print**: navigation and controls are `print:hidden`.

## Also check (added 2026-10-15)
- **Page title** is different on every route and says where you are (set in `metadata` or `generateMetadata`; a client page needs a `layout.tsx` for it). Root template: `%s · Divination Station`.
- **Status and error text** that appears after an action has `role="status"` or `role="alert"`; a loading state has text and a heading.
- **Label in name**: the accessible name starts with the visible text (voice control). A button's `aria-label` must not replace its words.
- **Reduced motion**: `app/globals.css` has a catch-all; new animations need no extra rule, but nothing may buzz (`navigator.vibrate`) or wait for an animation when it is on.
- **Forced colours** (Windows High Contrast): emulate `forcedColors: "active"`; a chosen state must not depend on a fill alone (see the block at the end of `globals.css`).
- **Text spacing and 200% text**: inject WCAG 1.4.12 spacing and `html{font-size:200%}`; nothing may be cut off or scroll sideways (list previews with `line-clamp` are fine if the full text is one click away).
- **Colour alone**: nothing is told apart by colour only; do not set text in a 60%-alpha colour (it fails contrast).
- **Pointer-only input** (drag, draw, hover) has a keyboard route or is optional.

## Whole-app runs (added 2026-10-23; work in the cloud and on Windows)
- `npx tsx scripts/a11y-audit.mts` (or `npm run a11y:audit`): every page, every axe rule at every impact, titles, landmarks, heading order, a full Tab walk (each stop named, with a focus ring, never on something hidden), contrast in all eight themes, reflow at 320 px and WCAG 1.4.12 text spacing, plus the signed-out pages. About 80 minutes for the whole app; `--only` and `--extra` (pages with an id) narrow it, `--skip themes` speeds it up.
- `npx tsx scripts/a11y-flows.mts` (or `npm run a11y:flows`): the main flows by keyboard only (every tool's draw, scrying, oracle card and pull, a tarot reading, guess first, a journal note, the reading tabs, the drawer, search, the skip link, Esc and the quick exit). It checks focus never falls to `<body>` after a step; it makes data, so use a scratch copy.
- Focus after a step: `components/FocusKeeper.tsx` (in the root layout) puts focus back when the pressed button turns itself off, moves it to the nearest heading when what had it is replaced, and to the new page's `<h1>` after a move inside the app. A component that knows better (a form that becomes a surface) moves focus itself first.
- An Esc a component uses to close something must call `e.preventDefault()`, or Esc to close it and Esc again sets off the quick exit (`components/QuickExitTriggers.tsx`).

## What you cannot do
Real touch and VoiceOver or TalkBack. List them under "owed" in your report and in PROGRESS.md; do not claim they passed.

## What you can do with NVDA
NVDA runs on this PC through Guidepup: `npm run test:sr` (setup and how to run it: `tests/a11y-sr/README.md`; needs a dev server and a dev-branch test account, and it speaks out loud, so tell the user first). Add a test in `tests/a11y-sr/` for any new drawer, menu, dialog or form. Ask NVDA what has focus (`reportCurrentFocus`) instead of trusting `lastSpokenPhrase` right after a focus change. Also wait out colour transitions before an axe contrast check, and check all seven themes (`lib/themes-data.ts`).

## Report
Checked, fixed, and owed, in three short lists.
