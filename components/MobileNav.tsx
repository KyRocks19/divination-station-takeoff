"use client";

import type { Shape } from "@/lib/edition";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NavBody from "@/components/nav/NavBody";
import { styleRef } from "@/lib/apply-style";
import type { DivinationKind } from "@/lib/divination-kinds";
import type { NavFoldKey } from "@/lib/nav-groups";

interface Props {
  username?: string;
  isAdmin?: boolean;
  edition?: Shape;
  /** The divination tools the person starred. Null means every tool. */
  tools: DivinationKind[] | null;
  /** The parts of the navigation the person folded away. */
  navFolded: NavFoldKey[];
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Below 1024 px: the menu button at the start of the header bar, and a drawer with the same navigation as the side
 * column. The drawer is drawn at the end of the page (a portal), outside the header's landmark, and opens below the header
 * bar (or from the top of the window when the header has scrolled away), so the header stays in view and the menu button
 * closes it again. It closes on Escape, on a
 * press outside it, on choosing a link, on a change of page, and when the window grows wide enough for the side column;
 * focus goes into it when it opens, stays inside it, and returns to the menu button. While the feedback window is open
 * over it, the drawer leaves the keyboard alone.
 */
export default function MobileNav({ username, isAdmin, edition, tools, navFolded }: Props) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  // Where the drawer starts: the bottom of the header bar as it is on the screen when the drawer opens. The page cannot
  // scroll while it is open, so this does not change until it closes.
  const [top, setTop] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const refocusButton = useRef(false);

  const close = useCallback((returnFocus: boolean) => {
    refocusButton.current = returnFocus;
    setOpen(false);
  }, []);

  // Focus goes back to the menu button only once the closed state is drawn, so a screen reader hears "collapsed" and
  // not the stale "expanded". A frame later, because after a pointer press the browser moves focus itself and would win.
  useEffect(() => {
    if (open || !refocusButton.current) return;
    refocusButton.current = false;
    const frame = requestAnimationFrame(() => button.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // A new page was reached (the back button, a link inside the page): the drawer is not wanted any more.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("[data-nav-close]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      // The feedback window is a modal dialog of its own, above the drawer: its keys are its own.
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        // A list opened inside the drawer (New reading) closes itself on Escape; the next press is for the drawer.
        if (panel.current?.querySelector("[data-popup-open]")) return;
        // Used here, so it is not one press of the quick exit's Esc Esc (components/QuickExitTriggers.tsx).
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      if (e.shiftKey && (here === first || !panel.current.contains(here))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (here === last || !panel.current.contains(here))) {
        e.preventDefault();
        first.focus();
      }
    };
    // The side column takes over from the drawer at 1024px, or wider at the larger text sizes (app/globals.css, "Side column at large text").
    const size = document.documentElement.dataset.size;
    const wide = window.matchMedia(`(min-width: ${size === "150" ? 1440 : size === "130" ? 1280 : 1024}px)`);
    const onWide = () => {
      if (wide.matches) close(false);
    };
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          if (open) {
            close(true);
            return;
          }
          const header = button.current?.closest("[data-app-header]");
          setTop(Math.max(0, Math.round(header?.getBoundingClientRect().bottom ?? 0)));
          setOpen(true);
        }}
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="menu-button lg:hidden min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-control text-bar-ink hover:text-bar-active text-2xl"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {open &&
        createPortal(
          <div ref={styleRef({ top })} className="print:hidden fixed inset-x-0 bottom-0 z-[60]">
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" onPointerDown={() => close(true)} />
            <div
              ref={panel}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`drawer-in absolute inset-y-0 left-0 w-[min(20rem,85vw)] flex flex-col overflow-y-auto overscroll-contain bg-bar text-bar-ink border-r border-blush-deep ${top === 0 ? "pt-[env(safe-area-inset-top)]" : ""} pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]`}
            >
              {/* NavBody draws the ✕ at the end of the Days row, at the top (owner's request, 2026-10-30); focus lands on it when the
                  drawer opens. */}
              <NavBody
                username={username}
                isAdmin={isAdmin}
                edition={edition}
                tools={tools}
                navFolded={navFolded}
                idPrefix="drawer"
                inDrawer
                onNavigate={() => close(true)}
                onClose={() => close(true)}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
