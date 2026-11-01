"use client";

import type { Shape } from "@/lib/edition";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { useOpenFeedback } from "@/components/FeedbackDialog";
import NewReadingMenu from "@/components/NewReadingMenu";
import { logout } from "@/components/nav/logout";
import RecentPages from "@/components/nav/RecentPages";
import NavGlyph, { hasNavGlyph } from "@/components/ui/NavGlyph";
import type { DivinationKind } from "@/lib/divination-kinds";
import { TOOLS_LINK, activeItemId, sideNavFor, toggleFold, type NavFoldKey, type NavItem } from "@/lib/nav-groups";

interface Props {
  username?: string;
  isAdmin?: boolean;
  /** Which edition this copy is: a local copy has no forum, circle, feedback or user pages. */
  edition?: Shape;
  /** The divination tools the person starred. Null means every tool. */
  tools: DivinationKind[] | null;
  /** The parts of the navigation the person folded away, as saved in their account. */
  navFolded: NavFoldKey[];
  /** Makes the heading ids differ between the desktop column and the phone drawer, which can both be in the page. */
  idPrefix: string;
  /** Called when a link is pressed (the drawer closes itself with it). */
  onNavigate?: () => void;
  /** Inside the phone and tablet drawer: taller rows for a finger, and on a narrow phone the parts of the header that do not fit in it. */
  inDrawer?: boolean;
  /** The desktop column is narrowed to its pictures: each link then carries its name as a tooltip. */
  narrow?: boolean;
  /** Draws the ✕ "Close menu" button at the right end of the top row (Days) and is called when it is pressed. */
  onClose?: () => void;
}

/**
 * Everything inside the navigation, shared by the desktop column and the phone drawer so they cannot drift apart: Days, the
 * person's tools, their writings, their people, what to learn from, help, and (for administrators) the admin pages. One link is marked
 * for the page the person is on.
 *
 * "Your tools" is one link to the home page, whose tiles list the tools and carry the stars (owner's request, 2026-10-25),
 * so the menu no longer repeats every tool.
 *
 * Each other group's heading is a button that folds the group away or opens it again, and so is Recent (which sits under
 * Your writings). What is folded
 * is kept in the person's account (migration 094), so the menu looks the same on every device and in the phone drawer.
 */
export default function NavBody({ username, isAdmin, edition = "hosted", tools, navFolded, idPrefix, onNavigate, inDrawer = false, narrow = false, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const openFeedback = useOpenFeedback();
  const active = activeItemId(pathname);
  const nav = sideNavFor(!!isAdmin, edition);

  const [folded, setFolded] = useState<NavFoldKey[]>(navFolded);
  const [message, setMessage] = useState({ text: "", n: 0 });
  const pendingFolds = useRef<NavFoldKey[] | undefined>(undefined);
  const foldBusy = useRef(false);

  // The folded parts can be changed in the other copy of this menu (the desktop column or the drawer).
  useEffect(() => {
    if (foldBusy.current || pendingFolds.current !== undefined) return;
    setFolded(navFolded);
  }, [navFolded]);

  const say = (text: string) => setMessage((m) => ({ text, n: m.n + 1 }));

  // Folding answers at once; the choice is saved behind it, one at a time and the newest last.
  async function flushFolds() {
    if (foldBusy.current) return;
    foldBusy.current = true;
    try {
      while (pendingFolds.current !== undefined) {
        const next = pendingFolds.current;
        pendingFolds.current = undefined;
        const res = await fetch("/api/prefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ navFolded: next }),
        });
        if (!res.ok) throw new Error();
      }
      router.refresh();
    } catch {
      // The menu stays as the person left it on this page; only keeping it for next time failed.
      pendingFolds.current = undefined;
      say("Could not keep this for next time. The menu changes on this page only.");
    } finally {
      foldBusy.current = false;
    }
  }

  function fold(key: NavFoldKey) {
    const next = toggleFold(folded, key);
    setFolded(next);
    pendingFolds.current = next;
    void flushFolds();
  }

  const isOpen = (key: NavFoldKey) => !folded.includes(key);

  const rowHeight = inDrawer ? "min-h-11" : "py-1.5";
  const linkClass = (here: boolean) =>
    `flex items-center gap-2 rounded-control px-2.5 text-sm transition-colors ${rowHeight} ${
      here ? "bg-bar-ink/[0.06] text-bar-active font-semibold" : "text-bar-ink hover:text-bar-active hover:bg-bar-ink/5"
    }`;

  /** The drawn picture for a link, or its emoji when it has no drawing. Both are decoration: the label is written beside it. */
  const glyph = (item: NavItem) =>
    hasNavGlyph(item.id) ? <NavGlyph id={item.id} className="h-5 w-5 shrink-0" /> : item.icon ? <span aria-hidden="true">{item.icon}</span> : null;

  function link(item: NavItem) {
    if (item.action === "feedback") {
      return (
        <button type="button" onClick={openFeedback} title={narrow ? item.label : undefined} className={`${linkClass(false)} w-full text-left`}>
          {glyph(item)}
          <span className="nav-text">{item.label}</span>
        </button>
      );
    }
    const here = active === item.id;
    return (
      <Link href={item.href ?? "/"} onClick={onNavigate} aria-current={here ? "page" : undefined} title={narrow ? item.label : undefined} className={linkClass(here)}>
        {glyph(item)}
        <span className="nav-text">{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      {inDrawer && (
        // On a narrow screen the header has room for the menu, the title and Settings only; the rest is here. The name
        // shows in the header from 768 px up, "+ New reading" and Log out from 640 px up.
        <div className="md:hidden px-4 pt-3 pb-3 space-y-3">
          {username && (
            <p className="text-xs text-bar-ink border border-bar-ink/40 rounded-full px-2.5 py-0.5 truncate max-w-full w-fit">
              <span className="sr-only">Signed in as </span>
              {username}
              {isAdmin && (
                <>
                  <NavGlyph id="admin" className="ml-1 inline-block h-4 w-4 align-[-0.2em]" />
                  <span className="sr-only">, administrator</span>
                </>
              )}
            </p>
          )}
          <div className="sm:hidden">
            <NewReadingMenu tools={tools} inline className={headerButtonClass} />
          </div>
        </div>
      )}

      <nav aria-label="Main" className={`flex-1 px-2 pb-6 space-y-5 ${inDrawer ? "pt-2" : "pt-4"}`}>
        {/* Days sits first, above Your tools and outside every group (owner's request, 2026-10-30). The ✕ lives in the first
            row, beside Days, so it is always at the very top, in the desktop column and the drawer alike (owner's request,
            2026-10-30). tests/nav-close-button.test.ts fails if it moves out. */}
        <ul className="list-none space-y-0.5">
          {nav.top.map((item, i) => (
            <li key={item.id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0">{link(item)}</div>
              {i === 0 && onClose && (
                <button
                  type="button"
                  data-nav-close
                  onClick={onClose}
                  aria-label="Close menu"
                  className={`nav-wide-only shrink-0 flex items-center justify-center rounded-control text-bar-ink hover:text-bar-active hover:bg-bar-ink/5 ${
                    inDrawer ? "min-h-11 min-w-11 text-2xl" : "min-h-8 min-w-8 text-xl"
                  }`}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {nav.groups.map((group) => {
          if (group.id === "tools") {
            const here = pathname === "/" || (active?.startsWith("tool-") ?? false);
            return (
              <Fragment key={group.id}>
                <section aria-label={TOOLS_LINK.label}>
                  <ul className="list-none">
                    <li>
                      <Link href="/" onClick={onNavigate} aria-current={pathname === "/" ? "page" : undefined} title={narrow ? TOOLS_LINK.label : undefined} className={linkClass(here)}>
                        <NavGlyph id="tools" group className="h-5 w-5 shrink-0" />
                        <span className="nav-text">{TOOLS_LINK.label}</span>
                      </Link>
                    </li>
                  </ul>
                  <p role="status" className="sr-only">
                    <span key={message.n}>{message.text}</span>
                  </p>
                </section>
              </Fragment>
            );
          }
          const foldKey = group.id;
          const headingId = `${idPrefix}-${group.id}`;
          const bodyId = `${headingId}-body`;
          const open = isOpen(foldKey);
          return (
            <Fragment key={group.id}>
            <section aria-labelledby={headingId} className="space-y-1">
              <h2 id={headingId} className="text-[11px] uppercase tracking-widest text-bar-ink/70">
                <button
                  type="button"
                  onClick={() => fold(foldKey)}
                  aria-expanded={open}
                  aria-controls={bodyId}
                  title={narrow ? `${open ? "Fold" : "Open"} ${group.label}` : undefined}
                  className={`flex items-center gap-1.5 w-full rounded-control px-2.5 text-left uppercase tracking-widest hover:text-bar-active hover:bg-bar-ink/5 ${
                    inDrawer ? "min-h-11" : "min-h-6 py-0.5"
                  }`}
                >
                  <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                  <NavGlyph id={foldKey} group className="nav-group-glyph h-4 w-4 shrink-0" />
                  <span className="nav-text">{group.label}</span>
                  {group.id === "admin" && <NavGlyph id="admin" className="nav-text h-3.5 w-3.5 shrink-0" />}
                </button>
              </h2>
              <div id={bodyId} className="space-y-1">
              {!open ? null : (
                <ul className="list-none space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>{link(item)}</li>
                  ))}
                </ul>
              )}
              </div>
            </section>
            {/* Right after the writings: the last few pages opened, kept on this device only. */}
            {group.id === "writing" && (
              <RecentPages
                username={username}
                headingId={`${idPrefix}-recent`}
                record={!inDrawer}
                onNavigate={onNavigate}
                rowClass={linkClass}
                rowHeight={rowHeight}
                open={isOpen("recent")}
                onToggle={() => fold("recent")}
                inDrawer={inDrawer}
              />
            )}
            </Fragment>
          );
        })}
      </nav>

      {inDrawer && (
        <div className="sm:hidden px-2 pb-6">
          <button type="button" onClick={logout} className={`${linkClass(false)} w-full text-left`}>
            Log out
          </button>
        </div>
      )}
    </>
  );
}

/** "+ New reading" drawn in the header bar's own colours (the page's pink button would vanish on the pink bar). */
export const headerButtonClass =
  "inline-flex items-center bg-bar-ink hover:bg-bar-active text-bar text-sm font-medium px-3 py-2 min-h-11 rounded-control transition-colors whitespace-nowrap";
