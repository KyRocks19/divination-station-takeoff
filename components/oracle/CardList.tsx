"use client";

import { useEffect, useRef, useState } from "react";
import ItemArt from "@/components/oracle/ItemArt";
import { formWords, type SetForm } from "@/lib/oracle-forms";
import { dropIndex, movedTo } from "@/lib/reorder";
import Link from "next/link";
import { CardLink } from "@/components/ui/Card";
import { useRouter } from "next/navigation";

export interface CardTile {
  id: number;
  name: string;
  origin: string | null;
  meaningCount: number;
  /** The picture's version and the person's description of it; null when the item has no picture. */
  artVersion: string | null;
  artAlt: string | null;
  /** A resting card stays in the deck but is not pulled. */
  resting: boolean;
}

interface Props {
  /** The set's form, for the words and the shape. */
  form?: SetForm;
  deckId: number;
  /** The deck's cards in the person's own order. */
  cards: CardTile[];
}

const moveButton =
  "text-xs text-tone-300 border border-line-strong hover:border-line-hover disabled:opacity-30 disabled:hover:border-line-strong rounded-control px-2.5 py-1.5 transition-colors whitespace-nowrap";

/**
 * The cards in a deck. "Change the order" turns the grid into a numbered list where each card can be
 * moved up or down, or dragged by its handle; every move is saved straight away.
 */
export default function CardList({ deckId, cards, form }: Props) {
  const w = formWords(form);
  const router = useRouter();
  const [order, setOrder] = useState(cards);
  const [loaded, setLoaded] = useState(cards);
  const [reordering, setReordering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // The item being dragged, and the order the list had when the drag began (to undo a cancelled drag).
  const [dragId, setDragId] = useState<number | null>(null);
  const dragStart = useRef<CardTile[] | null>(null);
  const rows = useRef(new Map<number, HTMLLIElement>());
  const orderNow = useRef(order);
  orderNow.current = order;

  // The page sent a fresh list (a card was added, deleted, or the page was reloaded): start from it.
  if (loaded !== cards) {
    setLoaded(cards);
    setOrder(cards);
  }

  // Saves a new order. If it cannot be saved the list goes back to how it was.
  async function persist(next: CardTile[], before: CardTile[], movedId: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/oracle/decks/${deckId}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_ids: next.map((c) => c.id) }),
      });
      if (res.status === 409) {
        setError(`The ${w.many} in this ${w.group} changed somewhere else, so the list was loaded again. Nothing was moved.`);
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error();
      const moved = next.find((c) => c.id === movedId);
      setAnnounce(moved ? `${moved.name} moved to place ${next.indexOf(moved) + 1} of ${next.length}.` : "");
    } catch {
      setOrder(before);
      setError(`Could not save the new order. The ${w.one} is back where it was.`);
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= order.length || saving) return;
    const next = movedTo(order, order[index].id, target);
    setOrder(next);
    persist(next, order, order[index].id);
  }

  function startDrag(e: React.PointerEvent<HTMLElement>, id: number) {
    if (saving || (e.pointerType === "mouse" && e.button !== 0)) return;
    // Stops the press from starting a text selection while the row is dragged.
    e.preventDefault();
    dragStart.current = order;
    setDragId(id);
  }

  function dragOver(clientY: number) {
    if (dragId === null) return;
    // Near the top or bottom of the window the page scrolls, so a long list can be dragged all the way.
    if (clientY < 70) window.scrollBy(0, -14);
    else if (clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    const current = orderNow.current;
    const middles = current.map((c) => {
      const box = rows.current.get(c.id)?.getBoundingClientRect();
      return box ? box.top + box.height / 2 : Number.POSITIVE_INFINITY;
    });
    const next = movedTo(current, dragId, dropIndex(middles, clientY));
    if (next !== current) {
      // Kept here as well as in state, so a release right after the last move still sees the order it ended with.
      orderNow.current = next;
      setOrder(next);
    }
  }

  function endDrag(cancelled: boolean) {
    if (dragId === null) return;
    const before = dragStart.current ?? order;
    const dropped = orderNow.current;
    const id = dragId;
    setDragId(null);
    dragStart.current = null;
    if (cancelled) {
      orderNow.current = before;
      setOrder(before);
      return;
    }
    if (before.some((c, i) => c.id !== dropped[i]?.id)) persist(dropped, before, id);
  }

  // While a row is dragged, the pointer is followed on the whole window. (Pointer capture on the handle would be lost
  // each time the row changes place, because moving a row in the list takes its element out and puts it back.)
  const drag = useRef({ dragOver, endDrag });
  drag.current = { dragOver, endDrag };
  useEffect(() => {
    if (dragId === null) return;
    const move = (e: PointerEvent) => drag.current.dragOver(e.clientY);
    const up = () => drag.current.endDrag(false);
    const cancel = () => drag.current.endDrag(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragId]);

  function finish() {
    setReordering(false);
    setError(null);
    router.refresh();
  }

  return (
    <section className="space-y-4" aria-labelledby="oracle-cards-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="oracle-cards-heading" className="text-sm text-ink-faint uppercase tracking-widest">
          {w.Many}{order.length > 0 ? ` (${order.length})` : ""}
        </h2>
        {order.length > 1 && (
          <button
            onClick={() => (reordering ? finish() : setReordering(true))}
            className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors"
          >
            {reordering ? "Done" : "Change the order"}
          </button>
        )}
      </div>

      {order.length === 0 ? (
        <p className="text-sm text-ink-ghost">This {w.group} has no {w.many}.</p>
      ) : reordering ? (
        <>
          <ol className="space-y-2 list-none p-0 m-0">
            {order.map((c, i) => (
              <li
                key={c.id}
                ref={(el) => {
                  if (el) rows.current.set(c.id, el);
                  else rows.current.delete(c.id);
                }}
                className={`flex items-center gap-3 bg-surface border rounded-card px-4 py-3 ${
                  dragId === c.id ? "border-focus shadow-lg" : "border-line"
                }`}
              >
                {/* A handle for dragging with a pointer or a finger. Keyboard and screen-reader users have the Up and
                    Down buttons, which do the same thing, so the handle is not a Tab stop. */}
                <span
                  aria-hidden="true"
                  title="Drag to move"
                  onPointerDown={(e) => startDrag(e, c.id)}
                  className={`touch-none select-none shrink-0 w-8 h-9 -ml-2 flex items-center justify-center text-ink-faint hover:text-ink-soft ${
                    dragId === c.id ? "cursor-grabbing" : "cursor-grab"
                  }`}
                >
                  ⠿
                </span>
                <span aria-hidden="true" className="text-xs text-ink-ghost w-5 text-right shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm text-ink-strong break-words">
                  {c.name}
                  {c.resting && <span className="ml-2 text-[10px] text-ink-faint uppercase tracking-wide">Resting</span>}
                </span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || saving}
                  aria-label={`Move ${c.name} up`}
                  className={moveButton}
                >
                  ↑ Up
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1 || saving}
                  aria-label={`Move ${c.name} down`}
                  className={moveButton}
                >
                  ↓ Down
                </button>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ink-ghost">Drag a row by its handle, or use Up and Down. Each move is saved straight away.</p>
          <p role="status" className="sr-only">{announce}</p>
        </>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 list-none p-0 m-0">
          {order.map((c) => (
            <li key={c.id}>
              <CardLink href={`/oracle/cards/${c.id}`} lift className={`h-full ${c.resting ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <ItemArt cardId={c.id} version={c.artVersion} alt={c.artAlt} form={form} height={48} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-strong break-words">{c.name}</p>
                {c.resting && <p className="text-[10px] text-ink-muted uppercase tracking-wide mt-1">Resting</p>}
                {c.origin && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{c.origin}</p>}
                {c.meaningCount > 0 && (
                  <p className="text-xs text-tone-500 mt-2">
                    {c.meaningCount} meaning{c.meaningCount !== 1 ? "s" : ""}
                  </p>
                )}
                  </div>
                </div>
              </CardLink>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </section>
  );
}
