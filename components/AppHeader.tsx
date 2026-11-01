"use client";

import type { Shape } from "@/lib/edition";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import NewReadingMenu from "@/components/NewReadingMenu";
import QuickExitTriggers from "@/components/QuickExitTriggers";
import SiteSearch from "@/components/SiteSearch";
import { headerButtonClass } from "@/components/nav/NavBody";
import { logout, quickExit } from "@/components/nav/logout";
import type { DivinationKind } from "@/lib/divination-kinds";
import { onSettings, type NavFoldKey } from "@/lib/nav-groups";
import AppSigil from "@/components/ui/AppSigil";
import NavGlyph from "@/components/ui/NavGlyph";

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
 * The header bar on every page for a signed-in person: who they are and their account, not places to go (those are in
 * the side navigation). The menu button (below 1024 px), the title, Search (the magnifier; its word from 1024 px; opens
 * the search window, components/SiteSearch.tsx), "+ New reading", their name, Settings and Log out. On a narrow phone
 * only the menu, the title, Search and Settings fit; the drawer holds the rest.
 *
 * It stays at the top while the page scrolls, except on a touch screen in a very short window (a phone on its side), where
 * it would take too much of the screen, and when the person chose "Scrolls away with the page" in Settings (`data-header` on <html>). `--header-h` in globals.css is its height, used by the side column and by scroll-padding so a
 * focused element is never hidden under it.
 */
export default function AppHeader({ username, isAdmin, edition, tools, navFolded }: Props) {
  const pathname = usePathname();
  const settingsHere = onSettings(pathname);

  return (
    <header
      data-app-header
      className="print:hidden sticky top-0 z-50 [@media(max-height:30rem)_and_(pointer:coarse)]:static bg-bar text-bar-ink border-b border-blush-deep pt-[env(safe-area-inset-top)]"
    >
      {/* Esc twice, and the other ways to set off the quick exit this device turned on in Settings. Only an administrator of a copy on their own computer can stop it. */}
      <QuickExitTriggers canStop={!!isAdmin && edition !== undefined && edition !== "hosted"} />
      <div className="flex items-center gap-1 sm:gap-2 h-14 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] lg:pl-4">
        <MobileNav username={username} isAdmin={isAdmin} edition={edition} tools={tools} navFolded={navFolded} />
        <Link
          href="/"
          className="min-w-0 min-h-11 flex items-center rounded-control px-1 text-bar-ink hover:text-bar-active font-bold text-lg tracking-widest leading-tight"
        >
          <AppSigil className="h-7 w-7 shrink-0 mr-2" strokeWidth={3} />
          <span className="truncate">Divination Station</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <SiteSearch edition={edition} />
          <div className="hidden sm:block">
            <NewReadingMenu tools={tools} className={headerButtonClass} />
          </div>
          {/* One button for "who I am and my settings": the cog, and from 768 px the name. Same shape and colours as
              "+ New reading" so the two read as a pair. The accessible name holds the visible name (label in name). */}
          <Link
            href="/settings"
            aria-current={settingsHere ? "page" : undefined}
            className={`${headerButtonClass} min-w-11 justify-center gap-2 ${settingsHere ? "bg-bar-active" : ""}`}
          >
            <span aria-hidden="true" className="text-lg leading-none">⚙</span>
            <span className="sr-only md:not-sr-only md:inline-block md:truncate md:max-w-[9rem] md:align-middle">
              {username ?? "Settings"}
              {username && isAdmin && <NavGlyph id="admin" className="hidden md:inline-block ml-1 h-4 w-4 align-[-0.2em]" />}
            </span>
            {username && <span className="sr-only">, Settings{isAdmin ? ", administrator" : ""}</span>}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="hidden sm:flex min-h-11 items-center rounded-control px-2 text-sm text-bar-ink hover:text-bar-active hover:bg-bar-ink/5 transition-colors whitespace-nowrap"
          >
            Log out
          </button>
          {/* The quick hide (named "quick exit" in the code): on every page and at every width, so it is there the moment it is needed. */}
          <button
            type="button"
            onClick={() => quickExit()}
            aria-label="Quick hide: hide this page and sign out (or press Esc twice)"
            className="min-h-11 flex items-center rounded-control border border-bar-ink/40 px-2 text-sm text-bar-ink hover:text-bar-active hover:bg-bar-ink/5 transition-colors whitespace-nowrap"
          >
            Hide
          </button>
        </div>
      </div>
    </header>
  );
}
