# Design system

This is the small set of tokens and shared pieces that every screen of the app is built from. It exists so a
change of look is made in one place, and so each new tool looks like part of the same app without copying style
strings. See it live at `/design` (sign in first).

Status (2026-10-12): built and signed off by the user: the tokens and shared pieces; every screen on the colour
tokens; the pink borders and buttons; the pink header bar and side navigation; eight checked themes (one of them light) with colours saved per person; and the
world map. Tidy-up slices A and B (below) moved the last private button and input strings and the stray hard-coded
colours onto the system; slice B's small colour shifts wait for the user's sign-off. Remaining gaps are listed
under "Known gaps" in the handoff summary of `.claude/skills/oracle-feature-design/PROGRESS.md`, which also holds
the plan and the user's answers.

## Rules
1. Use a token name, never a hard-coded hex value, in a class: write `bg-surface`, not `bg-[#12122a]`.
2. Use a shared piece (below) before writing a new style string. If none fits, add a piece here rather than a
   private copy in one file.
3. Keep it small. A piece is added only when two or more screens need it.
4. A new token has the value the app already used, unless the change of look is the point and the user asked for it.
5. **Never write `style={...}`** (2026-10-17, open item S4). The page's security policy refuses style attributes in production, so one would silently not apply, and `tests/no-inline-style.test.ts` fails if one is written. A fixed value is a class (`w-[140px]`, `pointer-events-none`, `[background:var(--color-surface-sunken)]`; on an SVG shape an attribute such as `cursor="pointer"` also works). A value that comes from the person's data (a colour they chose, a share of a total, a size from a prop) goes through `styleRef` (a `ref={styleRef({ width: "40%" })}` on an element in a client component) or `<Styled as="span" css={{ ... }} />` (anywhere, including server components), both from `lib/apply-style.ts`. They set the style from script, which the policy allows, so the element is plain until the page has loaded: give a bar `w-0` and anything whose size matters its size as a class. Do not use `<Image fill>` from `next/image` (it writes a style attribute): use `components/ui/FillImage.tsx`.

## Tokens
Defined in `app/globals.css` under `@theme`. Tailwind turns each into utilities.

| Token | Utility examples | What it is for |
|---|---|---|
| `canvas` | `bg-canvas` | the page background |
| `surface` | `bg-surface` | cards and panels |
| `surface-sunken` | `bg-surface-sunken` | a panel inside a panel |
| `field` | `bg-field` | the inside of an input |
| `line-faint`, `line`, `line-strong`, `line-accent`, `line-hover` | `border-line` | pink borders: dividers, cards, inputs and the header bar, a highlighted panel, border under the pointer |
| `focus` | `focus:border-focus` | the border of a box being typed in: a darker purple |
| `ink` | `text-ink` | body text |
| `ink-strong`, `ink-muted`, `ink-faint`, `ink-ghost` | `text-ink-muted` | text from strong to faint |
| `heading` | `text-heading` | page titles |
| `accent`, `accent-hover` | `bg-accent` | the purple button (kept as `Button` variant `purple`) |
| `accent-ink`, `accent-ink-hover` | `text-accent-ink` | links and small actions |
| `danger`, `danger-ink`, `danger-soft` | `text-danger`, `bg-danger/10` | errors and deletes: text, a tint (use an alpha), a border; lighter text steps |
| `success`, `success-ink` | `text-success`, `border-success/25` | a good or saved state, and its lighter text |
| `warning`, `warning-ink` | `text-warning`, `bg-warning/10` | a caution, and its lighter text |
| `blush`, `blush-soft`, `blush-deep` | `bg-blush`, `text-blush` | the pinks: light (main button, border base), medium (button under the pointer), vivid (border colour) |
| `radius-card`, `radius-control` | `rounded-card`, `rounded-control` | panels; buttons and inputs |
| `container-page` | `max-w-page` | the width of a page's content |

## Pieces (`components/ui/`)
- `Button.tsx`: `Button` and `ButtonLink` with variants `primary` (pink, dark text), `purple` (the earlier purple main button), `quiet`, `text`, `danger`; `buttonClass` holds the class strings. A `Button` is
  `type="button"` unless told otherwise.
- `Field.tsx`: `Input`, `Textarea`, `Select`, and `Field` (label, control, help, error). `fieldClass` is the shared look; `fieldFullClass` is the same at full width, and `fieldSmallClass` is the smaller type for boxes in a small-text panel. Use these in a file that writes its own `<input>`; never copy the string.
- `Card.tsx`: `Card` (padding `none`, `sm`, `md`), `CardLink` (a card that is one link; `lift` raises it under the pointer), and `cardLiftClass` for a list item that holds the link.
- `Page.tsx`: `Page` (width and rhythm), `PageTitle`, `SectionLabel`, `BackLink`, `ErrorNote`, and `JumpLinks` (a "Jump to" row of links to sections of the same page, for pages with many Tab stops: give each section the `id`; used on `/library`, `/archetypes`, `/design` and `/settings`, where a full index (`components/SettingsIndex.tsx`) takes its place on a wide page; added 2026-10-17).
- `Tile.tsx`: `Tile` (a picture, a name, an optional line and an optional `count` in the corner, as one link): the tiles on the home page. The picture is hidden from screen readers. Added 2026-10-15; eight hand-written copies of its class string became one piece. The home page draws its Your writings and Learn tiles from `NAV_GROUPS`, so they match the side navigation's names, order and pictures.
- `ToolGlyph.tsx`: `ToolGlyph` (`kind`, `className` for the size), the drawn line picture for each of the seven tools (a card with a star, two cards, a mirror on a stand, a swung pendulum beside its dotted resting place, a rune on a stone, strokes across a line, a die from a corner). It is drawn in the text colour (`currentColor`), so every theme colours it, and it is a decoration hidden from screen readers (the tool's name is always written beside it). It replaced the emoji in `DIVINATION_KIND_ICONS` on the home page's tool tiles, the rows of the side navigation, and the headings on the Library, Predictions and Sources pages (2026-10-18); `DIVINATION_KIND_ICONS` is kept as the plain-text fallback. Size it with classes: `h-5 w-5` in a navigation row, `h-8 w-8` on a tile, `h-[1.1em] w-[1.1em] align-text-bottom` beside a heading. A test (`tests/tool-glyph.test.ts`) checks that every tool has one, in `currentColor`, with no style attribute and no hard-coded colour.
- `NavGlyph.tsx`: `NavGlyph` (`id`, `className`) and `hasNavGlyph(id)`, the same kind of drawing for every navigation link that is not a tool, keyed by the item's id in `lib/nav-groups.ts` (Readings a sheet, Journals a book, Days a calendar, Patterns joined points, Predictions an eye, Layouts three places, Library books on a shelf, Sources two sheets, Forum two bubbles, Your circle three people, How this works a question mark, Send feedback an envelope, About a moon, and the admin links: two heads, a flag, a screen, a clipboard). Drawn in `currentColor`, hidden from screen readers, used in the side navigation rows (`h-5 w-5`) and on the home page's tiles (`h-8 w-8`). `icon` (an emoji) stays in the navigation data as the fallback for an item with no drawing. `tests/nav-glyph.test.ts` checks that every non-tool link has one and that drawings carry no style attribute, colour or lettering. Added 2026-10-18 (open item T16).
- `Styled.tsx`: `<Styled as="span" className="..." css={{ background: color }} />`, an element whose styles are worked out at run time (rule 5). `FillImage.tsx`: a picture that fills a positioned parent through Next.js's image optimizer, with no style attribute. Both added 2026-10-17.
- `Tabs.tsx`: `Tabs` (`label`, `tabs`, `active`, `onChange`, `tabId`, `panelId`), a row of tabs with one Tab stop, Left and Right (Home and End) to move, the chosen one underlined, and an optional count after a label with its own spoken words. The panels stay the page's own (`role="tabpanel"`, the ids from `panelId`, `aria-labelledby` from `tabId`). Used by the mobile sections of a tarot reading. Added 2026-10-29 (T18).
- `Dialog.tsx`: `Dialog` (`open`, `onClose`, `labelledBy`), a modal window: a native `<dialog>` opened with `showModal`, so Escape closes it and focus goes back where it was, and a click on the dimmed page closes it. The feedback window uses it. Added 2026-10-29 (T18).
- `lib/cx.ts`: joins class names.

Pieces outside `components/ui/` that other screens share: `components/sources/Cite.tsx` (the "Read more" line under a sentence, from `CITES` in `lib/sources.ts`) and `components/sources/SourcesLine.tsx` (the line at the foot of a tool's page that opens its bibliography).

## Moving a screen over
1. Replace the page wrapper with `Page`, the heading with `PageTitle`, the small caps headings with `SectionLabel`.
2. Replace private `const inputClass`, `primaryButton`, `textAction`, `dangerAction`, `quietButton` strings with
   `Input`, `Button`, and so on, then delete the private strings.
3. Replace `bg-[#12122a] border border-purple-900/30 rounded-xl` with `Card` or `CardLink`.
4. Compare the screen before and after; step 2 must not change the look.

## Not in the system yet
The drawn pictures (runes, staves, dice, pendulum, scrying) are left with their tools (recommended 2026-10-29 under T18, for the owner to confirm): each is drawn from its own data (a rune's strokes, a stave's notches, a die's pips, a swing's angle), they already draw in `currentColor` and tokens, and a shared piece would only pass those through. Tabs and modal dialogs are now `Tabs` and `Dialog` above. Not moved over yet: the search window (`components/SiteSearch.tsx`, a `<dialog>` with its own top-aligned placement), the card window in the library (`components/library/TarotLibrary.tsx`) and the mobile menu (`components/MobileNav.tsx`), which are `role="dialog"` panels with their own focus handling; move them when they are next changed. The pictures on "Circles and Tailscale" (`components/circles/CirclePictures.tsx`, 2026-10-26) draw the sky, lines, clothes and devices in tokens, so they follow every theme; only skin, hair and eyes are fixed colours, on purpose. Colours that stay fixed on purpose: the data colours for suits, tags, and card associations (`lib/suit-meta.ts`, `lib/card-associations.ts`, `components/TagManager.tsx`), the pictures, and the archived tower map.

## Step 2a swaps (same values, so no change in look)

| Old class | Token class |
|---|---|
| `bg-[#12122a]` | `bg-surface` |
| `bg-[#0f0f22]` | `bg-surface-sunken` |
| `bg-[#0d0d1a]` | `bg-field` inside an input, `bg-canvas` elsewhere |
| `border-purple-900/30`, `/40` | `border-line`, `border-line-strong` |
| `hover:border-purple-600/50` | `hover:border-line-hover` |
| `text-gray-200`, `400`, `500`, `600` | `text-ink-strong`, `ink-muted`, `ink-faint`, `ink-ghost` |
| `bg-purple-700 hover:bg-purple-600` | `bg-accent hover:bg-accent-hover` |
| `text-purple-400 hover:text-purple-200` | `text-accent-ink hover:text-accent-ink-hover` |
| `text-rose-500`, `hover:text-rose-400` | `text-danger`, `hover:text-danger-ink` |
| `text-2xl font-bold text-purple-200` | `text-2xl font-bold text-heading` |
| `border border-line rounded-xl` | `border border-line rounded-card` |
| `max-w-3xl mx-auto px-4` | `max-w-page mx-auto px-4` |

Left as they were at the time: colours used once or twice and the map and drawing colours. The one-offs were moved onto tokens in slice B (below).

## Step 2b: what moved

A script moved 62 files onto `Page`, `PageTitle`, `BackLink`, `SectionLabel`, `CardLink`, `ButtonLink`, `fieldClass`, and `buttonClass`. Every screen was fingerprinted before and after on the production build and the results were identical.

## Slice A: the leftovers of 2b (2026-10-12)
The private `inputClass`, `primaryButton`, `quietButton`, `textAction`, and `dangerAction` strings in 16 files were removed in favour of `fieldFullClass` and `buttonClass.*` (the values were identical). `DivinationJournal`, `MeaningsPanel`, `DeckSettings`, and the settings page lost their private strings; the forum list, the home page's number tiles, the oracle card list, and the readings list now use `CardLink lift` or `cardLiftClass` instead of a hand-written card string. The `quiet` button's hover text now follows the theme (`ink-soft`, it was `gray-300`).

## Slice B: stray colours onto tokens (2026-10-12)
Hard-coded colours outside the pictures became tokens, and a few small colour shifts came with them (listed in the commit and in PROGRESS.md for the user's sign-off). New tokens: `success`, `success-ink`, `warning`, `warning-ink`. Rose and red classes became `danger`, `danger-ink`, or `danger-soft` (the dark tints `rose-800` and `rose-900` became `danger` at a low alpha); green and emerald became `success`; amber became `warning`; `gray-100/700/800` and the grey borders became `ink-strong`, `ink-ghost`, `line`, and `line-strong`; the one-off dark backgrounds became `canvas`, `field`, and `surface-sunken`. The colour lab's picker does not list the four new tokens yet.

## The colour lab (see "Themes for everyone")

`/design` ("Colours") is the colour lab: a picker and hex box per token, ready-made themes, and "Copy changes as CSS" (the lines to paste into the `@theme` block of `app/globals.css` to make a choice the app's own). It was first an admin-only tool kept in the browser; it is now open to everyone and saved per person. To check a change to a token without stopping your dev server, see the working notes in `.claude/skills/oracle-feature-design/PROGRESS.md`.

## Pink borders, focus border, pink buttons (2026-10-11)

Borders are the vivid pink at a low share (14, 30, 44, and 62 percent for faint, normal, strong, and accent) and the light pink at 85 percent under the pointer. Light pink at a low share looks grey on a dark panel, which is why the vivid one is the base. A box being typed in has a `purple-700` border. The main button is pink with dark text; the purple one is `variant="purple"`. Selected or chosen states stay purple. Below 1024 pixels the side column becomes a drawer opened from the header's menu button.

## Themes for everyone (2026-10-12)

`/design` ("Colours") is open to everyone signed in. A person's colours are saved with their profile (`users.theme`) and put on `<html>` by the server. Eight ready-made themes are in `lib/themes-data.ts` (Violet night, Deep sea, Ember, Forest, Slate, Midnight, High contrast, and **Daylight**, the light one added for T9 on 2026-10-20), each checked for contrast (`CONTRAST_CHECKS` in `lib/theme-lab-shared.ts`, run for every theme by `tests/theme-palettes.test.ts`). The app's own colours are the default and are not listed; since 2026-10-12 they are the readable set and pass the same checks. A person can start from a theme and change any token, and `?theme=off` on any address shows the app's own colours (it switches off the `<style id="person-theme">` element the server writes; before 2026-10-20 it only removed inline properties and did nothing for a saved theme).

### Light themes (T9, 2026-10-20)

- **Daylight is a choice, never a default.** Nothing picks it for anyone and the app does not follow the device's light or dark setting (a test pins this). It is listed on `/design` with the others.
- **Tones keep their job, not their lightness.** On a dark page `tone-100` to `tone-500` are the light text shades and `tone-700` to `tone-900` the dark tints. In a light theme the text tones (100 to 600) are dark, `tone-700` is a purple that carries white text (chosen buttons), and `tone-800`/`tone-900` are light tints for panels drawn at a share of their strength (`bg-tone-800/60`). A light theme made by a person should follow the same rule.
- **The success and warning colours are lab tokens now** (`color-success`, `-success-ink`, `color-warning`, `-warning-ink`), because the app's own green and yellow are made for dark panels. The dark themes leave them alone.
- **Colours drawn as text from data** (a suit's blue, an element's amber) go through `styleRef`, which pulls a literal `color` toward `--color-ink-strong` by `--text-mix`. The variable is 0% unless the theme's page is light (`themeCss` sets 45%), so a dark page is unchanged.
- **Rendered Markdown** takes its colours from the tokens (`--tw-prose-invert-*` in `app/globals.css`); do not use fixed greys or white for text on a page.
- **SVG and canvas text** uses classes (`fill-ink`, `fill-ink-faint`, `fill-danger`) or reads the page's colours when it draws; never a hex colour made for a dark page. Self-contained dark objects (a card face, the pendulum board, a scrying surface, the sigil pad) keep their own dark colours on purpose.
- **Checked:** `SCREEN_CHECKS` in `lib/theme-lab-shared.ts` (135 pairs: every text token on the page, cards and inner panels, the solid and tinted buttons and chips, the error and alert tints) pass for Daylight. The dark themes are not held to the wider set; the test prints how they do (a few text-tone-600 and white-on-tone-700 pairs are under 4.5 to 1 in some). Not checked: a screen reader, a real device, and every screen by eye.

New tokens: `bar`, `bar-ink`, `bar-active` (the header bar, the side navigation, and the phone drawer), `ink-soft`, `danger-soft`, and `tone-100` to `tone-900` (the purple family for titles, labels, tints, and chosen states). **Use `tone-N` where you would have written `purple-N`, `violet-N`, or `indigo-N`, `ink-soft` for `gray-300`, and `danger-ink` and `danger-soft` for `rose-400` and `rose-300`; a raw colour class does not follow a person's theme.** Status colours (green, red, amber) and the colours drawn in the map and the pictures are still fixed.

## The world map (2026-10-12)

The home page's map (`components/world/WorldMap.tsx`) uses only tokens (`surface`, `blush`, `blush-deep`, `line`, and the text tokens), so it follows a person's colours. The coastlines and borders are Natural Earth 1:50m outlines in `public/world/countries-50m.json` (made by `scripts/build-world-map.ts`; the hand-written outline in `lib/world-map-data.ts` shows first); the points and their notes are in `lib/tool-origins.ts`. The earlier tower map is in `components/archive/` with a note on bringing it back.

## The navigation: header bar and side column (2026-10-15)
A header bar across the top and the side navigation under it, one list in two shells. Landmarks: the header is the page's `banner`, the side column's `<nav aria-label="Main">` is the navigation, then `<main id="main">`; the skip link stays first.
- **The header bar** (`components/AppHeader.tsx`, `data-app-header`) holds who the person is and their account, never places to go: the menu button (below 1024 px), the title (home), "+ New reading" (`NewReadingMenu` in the bar's own colours, `headerButtonClass` in `NavBody.tsx`: `bg-bar-ink text-bar`, because the pink button would vanish on the pink bar), Settings, which is **one button with the name in it** (the cog alone below 768 px, the cog and the person's name from 768 px; the same shape and colours as "+ New reading", `headerButtonClass`; `aria-current` and a filled background on `/settings` and `/design`; its accessible name is "name, Settings", with ", administrator" for an admin, so the visible name is inside it) and Log out (from 640 px). Changed 2026-10-17: the cog and the name used to be two controls. It is 3.5 rem tall (`--header-h` in `globals.css`), sticky, and scrolls away in a window under 30 rem tall (a phone on its side). `scroll-padding-top` keeps a focused element from landing under it (WCAG 2.4.11).
- **The groups** (`lib/nav-groups.ts`): Your tools, Your writings, Learn, Help and about, Admin (administrators only; an empty group is dropped). Each item has a picture, used in the column and on the home page tiles. `activeItemId`: the longest matching address wins, so one link is marked with `aria-current="page"`. `components/nav/NavBody.tsx` draws the groups for both shells, in the `bar` colours. Each link lives in one place: Settings and Log out are in the header only (on a narrow phone, Log out, the name and "+ New reading" move into the drawer).
- **Stars instead of a tools panel.** Each tool has a star button (`aria-pressed`, "Star Runes") that saves the person's tools at once (`toggleStar`; the last starred tool cannot be unstarred). The star buttons are `tabIndex={-1}`: with a keyboard, Space on the tool's link stars it, so the stars add no Tab stops, and a small "Space" hint shows while the link has keyboard focus. A screen reader's browse mode (NVDA, JAWS) takes Space as "press the link", so the spoken hint names the Star button too, which browse mode reaches. A starred or unstarred tool stays where it is until the next page, so nothing moves under the pointer or the focus; a `role="status"` line announces each change. Unstarred tools sit under "Other tools (n)".
- **Search** (2026-10-16, `components/SiteSearch.tsx`): a magnifier in the header (one Tab stop; its word from 1024 px, like Settings) and Ctrl+K or Cmd+K open a search window, a native modal `<dialog>` in the feedback window's look (`bg-surface`, `border-line-strong`, `rounded-card`), top-aligned so it does not jump as results arrive, the whole screen below 640 px. The field is a combobox (WAI-ARIA list autocomplete with automatic selection): results are a listbox of options grouped by kind (each group's visible heading is `aria-hidden`, its name is on the group), each option a real link with `tabIndex={-1}` and at least 44 px tall, the chosen one marked with `aria-selected:` background and a `focus` outline (seen in forced colours too). Only the count is read out (`role="status"`), never "Searching". The rules are in `lib/search-core.ts`, the queries in `lib/search.ts`, the shapes the browser needs in `lib/search-shared.ts` (it imports nothing, so the tarot deck stays out of the browser).
- **`sr-only` is Tailwind's own.** A hand-written `.sr-only` outside Tailwind's layer beat every layered `focus:not-sr-only` and `lg:not-sr-only`, so the skip link never showed on focus and the header's words never appeared; it was removed on 2026-10-16. Do not add one back.
- **Send feedback** in the column opens the feedback window over the page (`components/FeedbackDialog.tsx`, `useOpenFeedback`); the floating button that covered the corner of every page is gone.
- **From 1024 px up**, `components/SideNav.tsx` is a left column under the header, sticky, scrolling on its own. Narrowed to its pictures (3.5 rem) it sits beside the page; full (14 rem) it floats over the left of the page, keeping only the narrow width in the row so the page never moves, and its ✕ at the end of the Your tools row narrows it again (owner, 2026-10-26). The drawer's ✕ is in the same row; `NavBody` draws both, and `tests/nav-close-button.test.ts` keeps them there.
- **Below 1024 px**, `components/MobileNav.tsx` is the menu button in the header and a drawer from the left, drawn at the end of the page through a portal (`min(20rem, 85vw)`, rows at least 44 px tall, safe-area insets respected, the slide skipped for `prefers-reduced-motion`). It closes on Escape, a press on the scrim, a link, a change of page, or the window growing past 1024 px; focus moves in, is kept inside, and returns to the menu button; the page behind does not scroll. A list open inside it (`data-popup-open`, "+ New reading") takes the first Escape; while the feedback window is open over it, the drawer leaves the keyboard alone.
- The `Users` page (`/admin/users`) and the view of Claude's test accounts are in `components/admin/UserManagement.tsx`.

## Reading comfort (2026-10-15)

Settings has a "Reading comfort" panel (`components/ComfortSettings.tsx`, rules in `lib/comfort.ts`). It sets `data-font`, `data-size`, `data-spacing` and `data-motion` on `<html>` before first paint (the "Layout" card beside it, `LayoutSettings` in the same file, sets `data-header` and `data-sidebar` from the same record; both cards share `components/useComfort.ts`); the matching CSS is the last block of `app/globals.css`. **Size everything in rem** (not px) so the text-size choice scales it, let rows of buttons `flex-wrap`, and expect long words to break at the larger settings. A new animation needs no extra rule: the reduced-motion and "less motion" catch-alls cover it. Fonts are the `@fontsource` packages imported in `app/layout.tsx`.

## Touch targets (2026-10-17)
On a phone (under 640 px) every control is at least 44 px tall. The shared pieces carry it (`min-h-11 sm:min-h-0` in `buttonClass`, `fieldClass`, `ButtonLink`, `BackLink`), and a rule in the base layer of `app/globals.css` covers every `button`, `summary`, `select`, colour box and the row of a tick box or round choice that holds a bare input, unless the button is `tabindex="-1"` (a pointer-only star). It sits in the base layer so a class such as `min-h-0` can still say otherwise. Links inside a sentence are exempt (WCAG 2.5.8); a link on its own in a list or a row needs `max-sm:inline-flex max-sm:items-center max-sm:min-h-11`. When you write a text box by hand, copy `fieldClass` rather than the class string (several private copies were found and fixed). The world map's points stay small; the buttons below the map do the same and the map's label says so.
