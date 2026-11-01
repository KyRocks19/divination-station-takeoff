---
name: design-system-check
description: Scan changed UI for design-system violations (hard-coded colours, private copies of button/input styles) and print/responsive behaviour. Use after editing components, pages or globals.css.
---

# Design system check

The rules live in `docs/design-system.md`; tokens are in `app/globals.css` (`@theme`). Shared pieces: `components/ui/` (`Button`, `Field`, `Card`, `Page`, `Tile`). See the live page at `/design`.

## Scan the diff
Run on changed files (`git diff --name-only` plus untracked):

```bash
git diff -U0 -- '*.tsx' '*.ts' '*.css' | grep -nE '^\+' | grep -nE '#[0-9a-fA-F]{3,8}\b|\b(purple|violet|indigo|pink|rose|gray|slate|zinc|neutral|stone)-[0-9]{2,3}\b|\b(bg|text|border)-(white|black)\b'
```
Report every hit and fix it:
- **Hard-coded hex** in a class or style: use a token. Raw colour classes do not follow a person's saved theme.
- **`purple-N`, `violet-N`, `indigo-N`**: write `tone-N`. Grey and rose text: `ink-soft`, `danger-ink`, `danger-soft`.
- **Private copies** of a button, input, card, or page-wrapper class string: use `Button`, `Field`, `Card`, `Page`, `Tile`. Add a new shared piece only when **two screens** need it.
- A new token goes in `@theme` **and** the colour lab's list (`components/design/ThemeLab.tsx` and `lib/themes-data.ts`); a running dev server needs a restart to see it.

## Behaviour checks
- `print:hidden` on navigation and controls that should not print.
- Layouts: many pages set their own `max-w-*` and centre themselves; check nothing overflows sideways at 390, 768, 1100, 1280 px.
- Focus rings visible; text contrast holds in the seven checked themes (try two).
- Anything drawn from `localStorage`, `window`, or the time appears after an effect, not on first render.

## Docs
If a piece, token, or rule changed, update `docs/design-system.md` in the same slice. Do not leave a sentence there that names something you removed.

## Report
List violations found and fixed, and what you did not check (themes not opened, screen readers).
