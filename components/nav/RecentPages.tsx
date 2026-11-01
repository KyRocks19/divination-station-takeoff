"use client";

import Link from "next/link";
import NavGlyph from "@/components/ui/NavGlyph";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cleanTitle, recordable, type RecentPage } from "@/lib/recent-pages-core";
import { RECENT_CHANGED, clearRecentPages, loadRecent, recentIsOn, rememberPage } from "@/lib/recent-pages-store";

interface Props {
  /** Whose list this is. The list is kept per signed-in name on this device. */
  username?: string;
  headingId: string;
  /** Only one copy of the menu records pages (the desktop column is always on the page); the drawer only shows the list. */
  record: boolean;
  onNavigate?: () => void;
  /** The classes a menu row has, so these rows look like the others. */
  rowClass: (here: boolean) => string;
  /** The height class of a small row. */
  rowHeight: string;
  /** Whether the list is open; its heading folds it away or opens it again, like the menu's groups. */
  open: boolean;
  onToggle: () => void;
  /** Inside the phone and tablet drawer: a taller heading for a finger. */
  inDrawer?: boolean;
}

/**
 * "Recent": the last few pages the person opened, newest first, for getting back to one without searching. Its heading folds it like the menu's groups (the fold is saved with theirs). It is kept in
 * this browser only (lib/recent-pages-store.ts), is cleared at log out, can be switched off in Settings, and is not
 * sent anywhere. The first render is always empty and the list is read after it, so nothing depends on the browser at first paint.
 */
export default function RecentPages({ username, headingId, record, onNavigate, rowClass, rowHeight, open, onToggle, inDrawer = false }: Props) {
  const pathname = usePathname();
  const [list, setList] = useState<RecentPage[]>([]);
  const [on, setOn] = useState(false);

  // Read the list now, and again whenever it changes on this page (another copy of the menu, Settings, log out).
  useEffect(() => {
    const read = () => {
      setOn(recentIsOn());
      setList(loadRecent(username));
    };
    read();
    window.addEventListener(RECENT_CHANGED, read);
    return () => window.removeEventListener(RECENT_CHANGED, read);
  }, [username]);

  // A new page: once its title has been set, add it to the list.
  useEffect(() => {
    if (!record || !recordable(pathname)) return;
    const timer = setTimeout(() => {
      const title = cleanTitle(document.title);
      if (title) rememberPage(username, { path: pathname, title });
    }, 400);
    return () => clearTimeout(timer);
  }, [pathname, record, username]);

  // The page the person is on is not listed: it is already open.
  const others = list.filter((p) => p.path !== pathname);
  if (!on || others.length === 0) return null;
  const bodyId = `${headingId}-body`;

  return (
    <section aria-labelledby={headingId} className="space-y-1 nav-wide-only">
      <h2 id={headingId} className="text-[11px] uppercase tracking-widest text-bar-ink/70">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`flex items-center gap-1.5 w-full rounded-control px-2.5 text-left uppercase tracking-widest hover:text-bar-active hover:bg-bar-ink/5 ${
            inDrawer ? "min-h-11" : "min-h-6 py-0.5"
          }`}
        >
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          <NavGlyph id="recent" group className="h-4 w-4 shrink-0" />
          Recent
        </button>
      </h2>
      <div id={bodyId} className="space-y-1">
        {open && (
          <>
            <ul className="list-none space-y-0.5">
              {others.map((p) => (
                <li key={p.path}>
                  <Link href={p.path} onClick={onNavigate} className={rowClass(false)}>
                    <span className="truncate">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={clearRecentPages}
              className={`flex items-center w-full rounded-control px-2.5 text-xs text-bar-ink/80 hover:text-bar-active hover:bg-bar-ink/5 ${rowHeight}`}
            >
              Clear this list
            </button>
          </>
        )}
      </div>
    </section>
  );
}
