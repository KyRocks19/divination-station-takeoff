"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TAROT_DECK } from "@/lib/cards";
import { SUIT_META } from "@/lib/suit-meta";
import { ARCHETYPES, REALMS, getArchetype } from "@/lib/archetypes-data";
import { ORIENTATIONS, ORIENTATION_LABELS, orientationOf, type Orientation } from "@/lib/card-concept-edit-core";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";

interface Concept {
  id: number;
  name: string;
  display_name: string;
  reversed: boolean;
  cards: number;
  links: { slug: string; primary: boolean; aspect: string }[];
}
interface Board {
  card: { id: string; name: string };
  concepts: Concept[];
  counts: Record<string, { upright: number; reversed: number }>;
}
/** What is being dragged: some concepts of the open card, all the same way up. */
interface Carried { ids: number[]; orientation: Orientation }

const NONE = "";
const SUITS = ["major", "wands", "cups", "swords", "pentacles"];
const cardName = (id: string) => TAROT_DECK.find((c) => c.id === id)?.name ?? id;
const archetypeName = (slug: string) => (slug ? getArchetype(slug)?.name ?? slug : "Not sorted yet");
const firstOf = (c: Concept) => (c.links.find((l) => l.primary) ?? c.links[0])?.slug ?? NONE;
/** The concept's side of its archetypes, shown only when it is light or shadow. */
const sideOf = (c: Concept) => ({ light: "light", shadow: "shadow" } as Record<string, string>)[c.links[0]?.aspect ?? ""] ?? "";

/**
 * Three columns for one card at a time: the archetypes its concepts sit under, its concepts (upright and reversed), and
 * every card. Concepts and whole archetype groups are moved or copied to another card by dragging them onto it, or,
 * without a mouse, by choosing them and pressing that card's Upright or Reversed button. Dropping a concept on an
 * archetype makes it the concept's first archetype. Every change is saved at once and is shared by every account.
 */
export default function CardBoard({ initialCard }: { initialCard: string }) {
  const uid = useId();
  const router = useRouter();
  const [cardId, setCardId] = useState(initialCard);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [copy, setCopy] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState("");
  const [under, setUnder] = useState("");
  const [over, setOver] = useState<string | null>(null);
  const carried = useRef<Carried | null>(null);
  const ticket = useRef(0);

  const load = useCallback(async (id: string) => {
    const mine = ++ticket.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/archetypes/cards?card=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(res.status === 403 ? "Only an admin can change the cards." : "Could not load the card.");
      const data: Board = await res.json();
      if (mine === ticket.current) setBoard(data);
    } catch (e) {
      if (mine === ticket.current) setMessage(e instanceof Error ? e.message : "Could not load the card.");
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(cardId); }, [cardId, load]);

  function openCard(id: string) {
    if (id === cardId) return;
    setPicked(new Set());
    setFocus(null);
    setMessage("");
    setCardId(id);
    router.replace(`/archetypes/review?view=cards&card=${encodeURIComponent(id)}`, { scroll: false });
  }

  const concepts = useMemo(() => board?.concepts ?? [], [board]);

  /** The archetype groups of the open card, upright and reversed: first archetype -> its concepts. */
  const groups = useMemo(() => {
    const out: Record<Orientation, { slug: string; ids: number[] }[]> = { upright: [], reversed: [] };
    for (const o of ORIENTATIONS) {
      const by = new Map<string, number[]>();
      for (const c of concepts) {
        if (orientationOf(c.reversed) !== o) continue;
        const slug = firstOf(c);
        by.set(slug, [...(by.get(slug) ?? []), c.id]);
      }
      out[o] = [...by.entries()]
        .map(([slug, ids]) => ({ slug, ids }))
        .sort((a, b) => b.ids.length - a.ids.length || archetypeName(a.slug).localeCompare(archetypeName(b.slug)));
    }
    return out;
  }, [concepts]);

  /** The chosen concepts, split by which way up they sit on this card. */
  function pickedByOrientation(): Carried[] {
    return ORIENTATIONS.map((o) => ({
      orientation: o,
      ids: concepts.filter((c) => picked.has(c.id) && orientationOf(c.reversed) === o).map((c) => c.id),
    })).filter((g) => g.ids.length > 0);
  }

  async function send(loads: Carried[], to: { card: string; orientation: Orientation }) {
    const real = loads.filter((l) => !(to.card === cardId && to.orientation === l.orientation));
    if (real.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      let moved = 0;
      for (const l of real) {
        const res = await fetch("/api/archetypes/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: l.ids, from: { card: cardId, orientation: l.orientation }, to, copy }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save that.");
        moved += (await res.json()).moved ?? 0;
      }
      const where = `${cardName(to.card)}, ${to.orientation}`;
      setMessage(`${copy ? "Copied" : "Moved"} ${moved} concept${moved === 1 ? "" : "s"} to ${where}.`);
      setPicked(new Set());
      await load(cardId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save that.");
      await load(cardId);
    } finally {
      setBusy(false);
    }
  }

  async function putUnder(ids: number[], slug: string) {
    if (!slug || ids.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/archetypes/concepts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", ids, to: slug }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save that.");
      setMessage(`${ids.length} concept${ids.length === 1 ? " now sits" : "s now sit"} under ${archetypeName(slug)}.`);
      setPicked(new Set());
      setUnder("");
      await load(cardId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(ids: number[]) {
    setPicked((prev) => {
      const next = new Set(prev);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) if (all) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── dragging ──
  function startDrag(e: React.DragEvent, load: Carried) {
    carried.current = load;
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", load.ids.join(","));
  }
  function dragConcept(e: React.DragEvent, c: Concept) {
    const o = orientationOf(c.reversed);
    // Dragging a chosen concept carries every chosen concept that sits the same way up.
    const ids = picked.has(c.id)
      ? concepts.filter((x) => picked.has(x.id) && orientationOf(x.reversed) === o).map((x) => x.id)
      : [c.id];
    startDrag(e, { ids, orientation: o });
  }
  const target = (key: string, onDrop: (load: Carried) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!carried.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = copy ? "copy" : "move";
      if (over !== key) setOver(key);
    },
    onDragLeave: () => setOver((k) => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      const load = carried.current;
      carried.current = null;
      if (load && !busy) onDrop(load);
    },
  });
  const endDrag = () => { carried.current = null; setOver(null); };
  const lit = (key: string) => (over === key ? "border-line-accent bg-tone-900/40" : "border-line");

  const shownCards = useMemo(() => {
    const q = cardFilter.trim().toLowerCase();
    return TAROT_DECK.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [cardFilter]);

  const pickedCount = picked.size;
  const focusIds = focus === null ? null : new Set(ORIENTATIONS.flatMap((o) => groups[o].filter((g) => `${o}:${g.slug}` === focus).flatMap((g) => g.ids)));

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-card p-4 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
        <div>
          <label htmlFor={`${uid}-card`} className="block text-xs text-ink-faint mb-1">Card</label>
          <Select id={`${uid}-card`} value={cardId} onChange={(e) => openCard(e.target.value)}>
            {SUITS.map((s) => (
              <optgroup key={s} label={SUIT_META[s]?.label ?? s}>
                {TAROT_DECK.filter((c) => c.suit === s).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <legend className="text-xs text-ink-faint mb-1">Sending concepts to another card</legend>
          <label className="inline-flex items-center gap-2"><input type="radio" name={`${uid}-mode`} checked={!copy} onChange={() => setCopy(false)} className="accent-tone-600" /> Moves them</label>
          <label className="inline-flex items-center gap-2"><input type="radio" name={`${uid}-mode`} checked={copy} onChange={() => setCopy(true)} className="accent-tone-600" /> Copies them (they stay here too)</label>
        </fieldset>
      </div>

      {pickedCount > 0 && (
        <div className="sticky top-2 z-10 bg-surface border border-line-strong rounded-card p-3 flex flex-wrap items-center gap-3" role="group" aria-label="The chosen concepts">
          <p className="text-sm text-ink-soft">{pickedCount} chosen. Press Upright or Reversed beside a card to send them there.</p>
          <Select value={under} onChange={(e) => setUnder(e.target.value)} aria-label="Put the chosen concepts under an archetype" disabled={busy}>
            <option value="">Put under an archetype…</option>
            {REALMS.map((realm) => (
              <optgroup key={realm} label={realm}>
                {ARCHETYPES.filter((a) => a.realm === realm).map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </optgroup>
            ))}
          </Select>
          <Button disabled={busy || !under} onClick={() => putUnder([...picked], under)}>Put under</Button>
          <Button variant="quiet" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}

      <p className="text-sm text-ink-soft min-h-5" role="status">{loading ? "Loading…" : message}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        {/* ── Archetypes ── */}
        <section aria-labelledby={`${uid}-ah`} className="bg-surface border border-line rounded-card p-3 space-y-3">
          <h2 id={`${uid}-ah`} className="text-sm font-medium text-ink-strong">Archetypes</h2>
          <p className="text-xs text-ink-faint">The first archetype of each concept on {board?.card.name ?? "this card"}. Press one to choose its concepts; drag it to a card to send them all; drop a concept on one to put it there first.</p>
          {ORIENTATIONS.map((o) => (
            <div key={o} className="space-y-1.5">
              <h3 className="text-xs uppercase tracking-wide text-ink-faint">{ORIENTATION_LABELS[o]}</h3>
              {groups[o].length === 0 && <p className="text-xs text-ink-ghost">No concepts.</p>}
              <ul className="space-y-1 list-none p-0">
                {groups[o].map((g) => {
                  const key = `${o}:${g.slug}`;
                  const chosen = g.ids.every((id) => picked.has(id));
                  return (
                    <li
                      key={key}
                      draggable={!busy}
                      onDragStart={(e) => startDrag(e, { ids: g.ids, orientation: o })}
                      onDragEnd={endDrag}
                      {...(g.slug ? target(`a:${key}`, (load) => putUnder(load.ids, g.slug)) : {})}
                      onMouseEnter={() => setFocus(key)}
                      onMouseLeave={() => setFocus(null)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1 cursor-grab ${lit(`a:${key}`)}`}
                    >
                      <button
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => toggle(g.ids)}
                        onFocus={() => setFocus(key)}
                        onBlur={() => setFocus(null)}
                        className={`flex-1 text-left text-sm min-h-6 ${chosen ? "text-tone-200 font-medium" : "text-ink-soft hover:text-ink-strong"}`}
                      >
                        {archetypeName(g.slug)}
                      </button>
                      <span className="text-xs text-ink-faint">{g.ids.length}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* ── Concepts ── */}
        <section aria-labelledby={`${uid}-ch`} className="bg-surface border border-line rounded-card p-3 space-y-3">
          <h2 id={`${uid}-ch`} className="text-sm font-medium text-ink-strong">
            Concepts on {board?.card.name ?? "this card"}
          </h2>
          <p className="text-xs text-ink-faint">Drag a concept to a card, or between Upright and Reversed here. Choose several to carry them together.</p>
          {ORIENTATIONS.map((o) => {
            const list = concepts.filter((c) => orientationOf(c.reversed) === o);
            return (
              <div
                key={o}
                {...target(`o:${o}`, (load) => send([load], { card: cardId, orientation: o }))}
                className={`rounded-lg border p-2 space-y-1.5 ${lit(`o:${o}`)}`}
              >
                <h3 className="text-xs uppercase tracking-wide text-ink-faint">{ORIENTATION_LABELS[o]} ({list.length})</h3>
                {list.length === 0 && <p className="text-xs text-ink-ghost">No concepts {o}. Drop one here.</p>}
                <ul className="space-y-1 list-none p-0">
                  {list.map((c) => {
                    const dim = focusIds !== null && !focusIds.has(c.id);
                    return (
                      <li
                        key={c.id}
                        draggable={!busy}
                        onDragStart={(e) => dragConcept(e, c)}
                        onDragEnd={endDrag}
                        className={`flex items-start gap-2 rounded-md px-1.5 py-1 cursor-grab hover:bg-tone-900/30 ${dim ? "opacity-40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={picked.has(c.id)}
                          onChange={() => toggle([c.id])}
                          aria-label={`Choose ${c.display_name} (${o})`}
                          className="mt-1 accent-tone-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-strong break-words">{c.display_name}</p>
                          <p className="text-[11px] text-ink-ghost">
                            {archetypeName(firstOf(c))}{sideOf(c) ? ` (${sideOf(c)})` : ""} · on {c.cards} card{c.cards === 1 ? "" : "s"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        {/* ── Cards ── */}
        <section aria-labelledby={`${uid}-kh`} className="bg-surface border border-line rounded-card p-3 space-y-3">
          <h2 id={`${uid}-kh`} className="text-sm font-medium text-ink-strong">Cards</h2>
          <div>
            <label htmlFor={`${uid}-kf`} className="block text-xs text-ink-faint mb-1">Find a card</label>
            <Input id={`${uid}-kf`} value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} placeholder="for example: tower" autoComplete="off" />
          </div>
          <ul className="space-y-1 list-none p-0 max-h-[70vh] overflow-y-auto pr-1">
            {shownCards.map((card) => {
              const n = board?.counts[card.id] ?? { upright: 0, reversed: 0 };
              const open = card.id === cardId;
              return (
                <li key={card.id} className={`rounded-lg border px-2 py-1.5 space-y-1 ${open ? "border-line-accent" : "border-line"}`}>
                  <button
                    type="button"
                    onClick={() => openCard(card.id)}
                    aria-current={open ? "true" : undefined}
                    className={`w-full text-left text-sm min-h-6 ${open ? "text-tone-200 font-medium" : "text-ink-soft hover:text-ink-strong"}`}
                  >
                    {card.name}
                    <span className="ml-2 text-[11px] text-ink-ghost">{n.upright} upright · {n.reversed} reversed</span>
                  </button>
                  <div className="flex gap-1.5">
                    {ORIENTATIONS.map((o) => (
                      <button
                        key={o}
                        type="button"
                        aria-disabled={busy || pickedCount === 0}
                        onClick={() => (pickedCount === 0 ? setMessage("Choose some concepts first, or drag them here.") : !busy && send(pickedByOrientation(), { card: card.id, orientation: o }))}
                        {...target(`k:${card.id}:${o}`, (load) => send([load], { card: card.id, orientation: o }))}
                        aria-label={`Send the chosen concepts to ${card.name}, ${o}`}
                        className={`flex-1 rounded-md border text-xs min-h-6 px-2 text-ink-faint hover:text-ink-strong ${lit(`k:${card.id}:${o}`)}`}
                      >
                        {ORIENTATION_LABELS[o]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
