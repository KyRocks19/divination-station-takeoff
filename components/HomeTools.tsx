"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tile } from "@/components/ui/Tile";
import ToolGlyph from "@/components/ui/ToolGlyph";
import { DIVINATION_KIND_LABELS, DIVINATION_KIND_PAGES, DIVINATION_KINDS, SHOW_ALL_PARAM, type DivinationKind } from "@/lib/divination-kinds";
import { LOTS_TOOL, toggleStar } from "@/lib/nav-groups";

interface Props {
  /** The tools the person starred. Null means every tool. */
  tools: DivinationKind[] | null;
  /** True when the page was widened with "Show everything": every tool is in one grid. */
  widened: boolean;
}

/**
 * The home page's tool tiles, with the stars that used to sit beside each tool in the side navigation (moved here 2026-10-25, when
 * "Your tools" in the menu became one link to this page). Starred tools come first; the rest fold under "Other tools". A star saves
 * at once, and a tile that is starred or unstarred stays where it is until the page is opened again, so nothing moves under the pointer.
 */
export default function HomeTools({ tools, widened }: Props) {
  const router = useRouter();
  const restId = useId();
  const [starred, setStarred] = useState<DivinationKind[] | null>(tools);
  const [arranged] = useState<DivinationKind[] | null>(tools);
  const [restOpen, setRestOpen] = useState(false);
  const [message, setMessage] = useState({ text: "", n: 0 });
  const saved = useRef(tools);
  const pending = useRef<DivinationKind[] | null | undefined>(undefined);
  const busy = useRef(false);

  const say = (text: string) => setMessage((m) => ({ text, n: m.n + 1 }));

  // Saves one choice at a time, the newest last, so quick presses cannot arrive out of order.
  async function flush() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (pending.current !== undefined) {
        const next = pending.current;
        pending.current = undefined;
        const res = await fetch("/api/prefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tools: next }),
        });
        if (!res.ok) throw new Error();
        saved.current = next;
      }
      // A page that was widened with "Show everything" goes back to following the choice once the choice changes.
      const url = new URL(window.location.href);
      if (url.searchParams.has(SHOW_ALL_PARAM)) {
        url.searchParams.delete(SHOW_ALL_PARAM);
        router.replace(url.pathname + url.search);
      }
      router.refresh();
    } catch {
      pending.current = undefined;
      setStarred(saved.current);
      say("Could not save your stars. Nothing changed; try again.");
    } finally {
      busy.current = false;
    }
  }

  function star(kind: DivinationKind) {
    const label = DIVINATION_KIND_LABELS[kind];
    const result = toggleStar(starred, kind);
    if (!result) {
      say(`${label} is your only starred tool. Star another tool first.`);
      return;
    }
    setStarred(result.next);
    say(result.starred ? `${label} added to your tools.` : `${label} taken out of your tools.`);
    pending.current = result.next;
    void flush();
  }

  const isStarred = (kind: DivinationKind) => starred === null || starred.includes(kind);
  const inFirst = (kind: DivinationKind) => widened || arranged === null || arranged.includes(kind);
  const first = DIVINATION_KINDS.filter(inFirst);
  const rest = DIVINATION_KINDS.filter((k) => !inFirst(k));

  const tile = (kind: DivinationKind) => {
    const on = isStarred(kind);
    return (
      <li key={kind} className="relative">
        <Tile href={DIVINATION_KIND_PAGES[kind]} icon={<ToolGlyph kind={kind} className="inline-block h-8 w-8" />} label={DIVINATION_KIND_LABELS[kind]} className="block h-full" />
        <button
          type="button"
          aria-pressed={on}
          aria-label={`Star ${DIVINATION_KIND_LABELS[kind]}`}
          onClick={() => star(kind)}
          className="absolute top-1 left-1 min-h-11 min-w-11 flex items-center justify-center rounded-control text-lg text-tone-300 hover:text-ink-strong hover:bg-tone-700/30"
        >
          <span aria-hidden="true">{on ? "★" : "☆"}</span>
        </button>
      </li>
    );
  };

  return (
    <>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 list-none p-0">
        {first.map(tile)}
        {/* Tossing lots works on readings from the other tools, so it has no star of its own and is always listed. */}
        <li>
          <Tile href={LOTS_TOOL.href!} icon={LOTS_TOOL.icon} label={LOTS_TOOL.label} note={LOTS_TOOL.note} className="block h-full" />
        </li>
      </ul>
      {rest.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setRestOpen((o) => !o)}
            aria-expanded={restOpen}
            aria-controls={restId}
            className="flex items-center gap-1.5 min-h-11 text-sm text-ink-muted hover:text-ink-strong"
          >
            <span aria-hidden="true">{restOpen ? "▾" : "▸"}</span>
            Other tools ({rest.length})
          </button>
          <div id={restId}>
            {restOpen && (
              <>
                <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 list-none p-0">{rest.map(tile)}</ul>
                <p className="text-xs text-ink-faint mt-2">Star a tool to keep it with your tools.</p>
              </>
            )}
          </div>
        </div>
      )}
      <p role="status" className="sr-only">
        <span key={message.n}>{message.text}</span>
      </p>
    </>
  );
}
