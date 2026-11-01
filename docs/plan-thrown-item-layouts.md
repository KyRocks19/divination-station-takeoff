# Plan: layouts for thrown items (T4)

Written 2026-10-18. **Steps 1 to 4 were built later the same day** (commit `ba4d9c3`, migration 077; the build is called "cloths" in the app; the rest was built on 2026-10-20: dragging dots on the picture (`lib/cloth-drag.ts`), Patterns counts across cloths, and three example cloths behind a button (`lib/cloth-examples.ts`); search for cloths and zones was built earlier (Y16); more example cloths are T4d in `docs/open-items.md`). Differences from the sketch in section 3: cloths are their own tables (`cloths`, `cloth_zones`, `cloth_placements`) and not a new kind of `layouts` row, so no tool's layout picker had to change; zone geometry is a small JSON object checked by `lib/cloth-core.ts`; places are whole numbers from 0 to 1000, shown as percents; a freehand zone is typed as one corner per line; the cloth section is on the runes, ogham, dice and oracle pages (tarot was not among the tools named). The five questions in section 4 were answered the same day (see "Decided" just below). It is the one Wave 4 item the handoff said to plan and stop on.

**Current status:** T4b (remaining implementation) and T4c (whether tarot should get cloth sections) in `docs/open-items.md` are authoritative; this plan retains the design and implementation history.

**Current status:** T4b (remaining implementation) and T4c (whether tarot should get cloth sections) in `docs/open-items.md` are authoritative; this plan retains the design and implementation history.

## Decided (the user, 2026-10-18)
1. **Real and simulated throws, both** in the first version: the person can record where real items landed, and the app can throw and drop items itself. (Steps 2 and 3 below are built together; step 1 first.)
2. **Every tool that has items at once**: runes, ogham, dice and coins, and oracle items. One design for all, so the item and zone recording must not assume a tool.
3. **Zone shapes: circle, ring, rectangle, half, wedge and freehand.** Freehand and wedges need a way that does not depend on a pointer: a typed list of points for a freehand zone (a corner at a time) and a typed start angle and width for a wedge, beside the drag.
4. **Zone meanings: the app supplies none now.** A few labelled, sourced example cloths may come later, behind a button, saying where each comes from and how settled it is; any tradition that asks for its keepers' permission is left out until it is given (`write-ritual-source`).
5. **Facing is recorded with the zone**: how an item landed (a rune face up or down, the face of a die or coin) is stored with where it landed.

Historical pre-build questions; the owner's answers and the implementation choices are recorded in the decision section below.

## 1. What exists today

- A **layout** is a list of named positions, each with an optional question, a colour, and (for a board layout) a place and a turn on a board (`layouts`, `layout_positions`, migrations 029 and 032; `lib/layouts*.ts`, `components/LayoutPicker.tsx`).
- A draw with a layout puts **one item in each position**: the first rune goes to position 1, the second to position 2. The reading remembers each position's name as it was then.
- Dice and coins: since this week a throw can hold several kinds of object (`dice_throws` has an `object` on every row). A layout still goes with **one kind** of object, and one die per position.

## 2. The idea

In casting traditions (runes, bones, shells, dice on a cloth) the items are **thrown** onto a cloth and read by **where each one landed**: inside a ring or outside it, near the middle, on the left half, off the cloth. There is no "position 3" that an item is dealt to. The cloth has **zones**, and an item belongs to the zone it landed in, whichever order it was thrown in. Which way an item faces (a rune face down, a die's number) is read as well.

So a cloth is a different shape from today's layout: **zones that items fall into** rather than **slots that items are dealt to**.

## 3. A way to build it (small steps, each one usable)

1. **A cloth layout with zones.** Same Layouts page, a new kind: "Cloth". Zones are named areas the person draws (a circle, a ring, a rectangle, a half), each with the person's own words and colour, plus an automatic "Off the cloth". The editor reuses the board editor's dragging and snapping, and also has a **form with no dragging** (zone type, centre, size typed in numbers), so it works from a keyboard and a screen reader.
2. **Record where real items landed.** After a physical throw, the person says, for each item, which zone it landed in (a list with one choice box per item; also tap on the picture of the cloth). Stored per item: the zone's name as it was then, and, when tapped, the place. This works for any tool that has items: runes, ogham, dice and coins, oracle items.
3. **Let the app throw.** The app drops each item at a random place on the cloth with the person's chosen random method, and says which zone each fell into. For dice this is the existing throw with a cloth instead of a list.
4. **Patterns.** "Which zone things land in" counted over time, plain counts only, kept apart from any meaning.

Each step is its own commit and works without the next one.

### What would be stored (a sketch, not a migration yet)
- `layouts.kind` gets a value `cloth`; its zones are rows like `layout_positions` with a shape and size (`shape`, `x`, `y`, `w`, `h` or a radius).
- A new table for where each item landed (`divination_id`, item order, zone name as then, optional `x`, `y`), owned by the person and deleted with the reading.
- Because this is a person's own words about their own throws, `data-lifecycle-check` applies in full: scoping by user, deletion, the Settings export, search, the companion (own words only), and the privacy notice. Zone names and notes must never be sent to the companion as stock text.

## 4. Questions for you (answered 2026-10-18)

1. **Real items, simulated items, or both?** Recording where a real throw landed (step 2) is the part that matches the tradition. A simulated throw (step 3) is more like the rest of the app. **My suggestion: step 2 first, step 3 later.**
2. **Which tools first?** Runes are the best-known cloth casting. Dice and coins already take mixed objects. **My suggestion: runes and dice first, then the others.**
3. **Zone shapes.** Circle, ring and rectangle only, or also freehand and wedges? **My suggestion: circle, ring, rectangle, and "half" (a line across the cloth), because each is a single typed number or a drag.**
4. **Does the app say anything about what a zone means?** Today the app supplies no meaning for any position. For casting cloths some traditions do have fixed zone meanings, and some of them are living or closed traditions. **My suggestion: the app supplies none**, and any sourced example cloth only comes later, through `write-ritual-source`, with the keepers' permission where a tradition asks for it.
5. **Facing.** A rune lands face up or face down; a coin shows a side. Do you want facing read as part of where it landed (for example "face down, in the outer ring")? Runes already have reversed pulls, so this may be simply the same thing.

## 5. What I will check when it is built
`add-migration` (dev branch first; you run live), `data-lifecycle-check`, `accessibility-pass` (the cloth must work with a keyboard and a screen reader: the picture is a decoration, the list and form are the real controls), `client-safety-check`, `copy-check` (plain words about "landed", never "fell where fate wanted"), `design-system-check`, and a browser test at 1280 and 390 px. Real touch and a screen reader will still be owed.
