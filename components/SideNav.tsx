"use client";

import type { Shape } from "@/lib/edition";
import { useEffect, useRef, useState } from "react";
import NavBody from "@/components/nav/NavBody";
import type { DivinationKind } from "@/lib/divination-kinds";
import type { NavFoldKey } from "@/lib/nav-groups";
import { applyNavWidth, navIsNarrow } from "@/lib/nav-width";

interface Props {
  username?: string;
  isAdmin?: boolean;
  edition?: Shape;
  /** The divination tools the person starred. Null means every tool. */
  tools: DivinationKind[] | null;
  /** The parts of the navigation the person folded away. */
  navFolded: NavFoldKey[];
}

/**
 * The side navigation: a left column from 1024 px up, under the header bar, that stays in place while the page scrolls
 * and scrolls on its own when it is taller than the window. Below 1024 px, MobileNav does the same job in a drawer.
 *
 * The column can be narrowed to its pictures with the button at its foot, or with the ✕ at the end of the full menu's
 * Days row, at the very top. Narrowed, it sits beside the page; full, it floats over the left of the page (owner's request, 2026-10-26), so
 * opening it does not move the page. The choice is kept in this browser and put on <html> before the first paint
 * (lib/nav-width.ts), so the CSS in app/globals.css draws the right width from the start; this component only follows it
 * after the page has loaded.
 */
export default function SideNav(props: Props) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow(navIsNarrow()), []);
  const widenButton = useRef<HTMLButtonElement>(null);

  function toggle() {
    const next = !narrow;
    setNarrow(next);
    applyNavWidth(next);
  }

  // The ✕ goes away with the full menu, so focus moves to the button that widens it again.
  function closeToPictures() {
    setNarrow(true);
    applyNavWidth(true);
    requestAnimationFrame(() => widenButton.current?.focus());
  }

  return (
    // A plain box, not <aside>: the <nav> inside is the landmark, and a "complementary" region around it only adds noise.
    <div
      className="sidenav print:hidden hidden lg:flex flex-col w-56 shrink-0 sticky top-(--header-h) h-[calc(100dvh-var(--header-h))] bg-bar text-bar-ink border-r border-blush-deep"
    >
      {/* The links scroll on their own; the button below stays put under them and never covers a link. `relative` keeps the
          words hidden for screen readers (sr-only, and every label in the narrow column) inside this scrolling box: without it
          they hang below the column, make the page taller than the row the column sticks in, and at the end of a short page
          the column slid up under the header. */}
      <div className="relative flex flex-col flex-1 min-h-0 overflow-y-auto">
        {/* NavBody draws the ✕ beside Days, at the top; it shows on the full menu only and narrows it back to its pictures. */}
        <NavBody {...props} idPrefix="sidenav" narrow={narrow} onClose={closeToPictures} />
      </div>
      <div className="border-t border-blush-deep/60 px-2 py-2">
        <button
          ref={widenButton}
          type="button"
          onClick={toggle}
          aria-pressed={narrow}
          title={narrow ? "Press to widen the menu" : undefined}
          className="nav-narrow-button flex items-center gap-2 w-full rounded-control px-2.5 py-1.5 min-h-8 text-xs text-bar-ink/80 hover:text-bar-active hover:bg-bar-ink/5"
        >
          <span aria-hidden="true">{narrow ? "»" : "«"}</span>
          <span className="nav-text">Narrow menu</span>
        </button>
      </div>
    </div>
  );
}
