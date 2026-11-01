"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ARCHETYPES, REALMS, getArchetype } from "@/lib/archetypes-data";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";

interface Link_ { slug: string; primary: boolean; aspect: string }
interface OnCard { card: string; name: string; reversed: boolean }
interface Row { id: number; name: string; display_name: string; realm: string | null; cards: number; links: Link_[]; on_cards: OnCard[] }

const PAGE = 50;
const CARDS_SHOWN = 12;

/** The cards a concept sits on, each a link to that card on the By card tab. Long lists fold after the first few. */
function CardNames({ cards }: { cards: OnCard[] }) {
  if (cards.length === 0) return <p className="text-[11px] text-ink-ghost">On no cards.</p>;
  const chip = (c: OnCard) => (
    <li key={`${c.card}-${c.reversed}`}>
      <Link
        href={`/archetypes/review?view=cards&card=${encodeURIComponent(c.card)}`}
        className="inline-flex items-center min-h-6 rounded-full border border-line px-2 text-[11px] text-ink-soft hover:text-ink-strong hover:border-line-hover"
      >
        {c.name}
        {c.reversed && <span className="ml-1 text-ink-faint">(reversed)</span>}
      </Link>
    </li>
  );
  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap gap-1 list-none p-0" aria-label="Cards it sits on">{cards.slice(0, CARDS_SHOWN).map(chip)}</ul>
      {cards.length > CARDS_SHOWN && (
        <details>
          <summary className="text-[11px] text-ink-faint cursor-pointer min-h-6">{cards.length - CARDS_SHOWN} more cards</summary>
          <ul className="flex flex-wrap gap-1 list-none p-0 pt-1">{cards.slice(CARDS_SHOWN).map(chip)}</ul>
        </details>
      )}
    </div>
  );
}
const ASPECT_LABELS: Record<string, string> = {
  light: "Light",
  shadow: "Shadow",
  neutral: "Either",
};

/** A choice of archetype, grouped by realm. */
function ArchetypeOptions() {
  return (
    <>
      {REALMS.map((realm) => (
        <optgroup key={realm} label={realm}>
          {ARCHETYPES.filter((a) => a.realm === realm).map((a) => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/**
 * Review and change which archetypes the tarot concepts sit under. Every change is saved at once. Concepts are
 * shared by every account, so the page is for admins (the API refuses anyone else).
 */
export default function ReviewBoard() {
  const uid = useId();
  const [archetype, setArchetype] = useState("");
  const [aspect, setAspect] = useState("");
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [moveTo, setMoveTo] = useState("");
  const pending = useRef(0);

  const load = useCallback(async (offset: number, append: boolean) => {
    const ticket = ++pending.current;
    setLoading(true);
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (archetype) params.set("archetype", archetype);
    if (aspect) params.set("aspect", aspect);
    if (q) params.set("q", q);
    try {
      const res = await fetch(`/api/archetypes/concepts?${params}`);
      if (!res.ok) throw new Error(res.status === 403 ? "Only an admin can review the sorting." : "Could not load the concepts.");
      const data = await res.json();
      if (ticket !== pending.current) return; // a newer search replaced this one
      setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
      setTotal(data.total);
      setMessage("");
    } catch (e) {
      if (ticket === pending.current) setMessage(e instanceof Error ? e.message : "Could not load the concepts.");
    } finally {
      if (ticket === pending.current) setLoading(false);
    }
  }, [archetype, aspect, q]);

  useEffect(() => { setPicked(new Set()); load(0, false); }, [load]);

  /** Sends one change, then swaps in the rows the server sends back. A row that no longer fits the filter stays until the next search. */
  async function change(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/archetypes/concepts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save that. Nothing was changed.");
      const data = await res.json();
      const updated = new Map<number, Row>((data.rows as Row[]).map((r) => [r.id, r]));
      setRows((prev) => prev.map((r) => updated.get(r.id) ?? r));
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save that. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  function togglePicked(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const nameOf = (slug: string) => getArchetype(slug)?.name ?? slug;

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); }}
        className="bg-surface border border-line rounded-card p-4 grid gap-3 sm:grid-cols-4"
        aria-label="Find concepts"
      >
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-q`} className="block text-xs text-ink-faint mb-1">Search concepts</label>
          <Input id={`${uid}-q`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="for example: money" autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`${uid}-a`} className="block text-xs text-ink-faint mb-1">Archetype</label>
          <Select id={`${uid}-a`} value={archetype} onChange={(e) => setArchetype(e.target.value)}>
            <option value="">All concepts</option>
            <option value="none">Not sorted yet</option>
            <ArchetypeOptions />
          </Select>
        </div>
        <div>
          <label htmlFor={`${uid}-s`} className="block text-xs text-ink-faint mb-1">Side</label>
          <Select id={`${uid}-s`} value={aspect} onChange={(e) => setAspect(e.target.value)}>
            <option value="">Any</option>
            {Object.entries(ASPECT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div className="sm:col-span-4 flex items-center gap-3">
          <Button type="submit">Search</Button>
          <p className="text-xs text-ink-faint" role="status">
            {loading ? "Loading…" : `${total} concept${total === 1 ? "" : "s"}${rows.length < total ? `, showing ${rows.length}` : ""}`}
          </p>
        </div>
      </form>

      {picked.size > 0 && (
        <div className="sticky top-2 z-10 bg-surface border border-line-strong rounded-card p-3 flex flex-wrap items-center gap-3" role="group" aria-label="Move the chosen concepts">
          <p className="text-sm text-ink-soft">{picked.size} chosen</p>
          <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move to">
            <option value="">Move to…</option>
            <ArchetypeOptions />
          </Select>
          <Button
            disabled={busy || !moveTo}
            onClick={() => change({ action: "move", ids: [...picked], to: moveTo }, `Moved ${picked.size} to ${nameOf(moveTo)}.`).then(() => setPicked(new Set()))}
          >
            Move
          </Button>
          <Button variant="quiet" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}

      {message && <p className="text-sm text-ink-soft" role="status">{message}</p>}

      <ul className="space-y-2 list-none p-0">
        {rows.map((r) => {
          const first = r.links.find((l) => l.primary) ?? r.links[0];
          const others = r.links.filter((l) => l !== first);
          return (
            <li key={r.id} className="bg-surface border border-line rounded-card p-3 space-y-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={picked.has(r.id)}
                  onChange={() => togglePicked(r.id)}
                  aria-label={`Choose ${r.display_name}`}
                  className="mt-1 accent-tone-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-strong break-words">{r.display_name}</p>
                  <p className="text-[11px] text-ink-ghost">
                    on {r.cards} card{r.cards === 1 ? "" : "s"} ·{" "}
                    <Link href={`/encyclopedia/${encodeURIComponent(r.name)}`} className="underline hover:text-ink-soft">open</Link>
                  </p>
                  <div className="mt-1"><CardNames cards={r.on_cards ?? []} /></div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:pl-7">
                <div>
                  <label className="block text-[11px] text-ink-faint mb-0.5" htmlFor={`${uid}-p${r.id}`}>First archetype</label>
                  <Select
                    id={`${uid}-p${r.id}`}
                    value={first?.slug ?? ""}
                    disabled={busy}
                    onChange={(e) => e.target.value && change({ action: "move", ids: [r.id], to: e.target.value }, `${r.display_name} now sits under ${nameOf(e.target.value)}.`)}
                  >
                    {!first && <option value="">Not sorted yet</option>}
                    <ArchetypeOptions />
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-faint mb-0.5" htmlFor={`${uid}-s${r.id}`}>Side</label>
                  <Select
                    id={`${uid}-s${r.id}`}
                    value={first?.aspect ?? "light"}
                    disabled={busy || !first}
                    onChange={(e) => change({ action: "aspect", ids: [r.id], aspect: e.target.value }, `${r.display_name}: ${ASPECT_LABELS[e.target.value].toLowerCase()} side.`)}
                  >
                    {Object.entries(ASPECT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-faint mb-0.5" htmlFor={`${uid}-add${r.id}`}>Also under</label>
                  <Select
                    id={`${uid}-add${r.id}`}
                    value=""
                    disabled={busy}
                    onChange={(e) => e.target.value && change({ action: "add", id: r.id, slug: e.target.value }, `${r.display_name} is also under ${nameOf(e.target.value)}.`)}
                  >
                    <option value="">Add an archetype…</option>
                    <ArchetypeOptions />
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-faint mb-0.5" htmlFor={`${uid}-r${r.id}`}>Realm</label>
                  <Select
                    id={`${uid}-r${r.id}`}
                    value={r.realm ?? ""}
                    disabled={busy}
                    onChange={(e) => change(
                      { action: "realm", ids: [r.id], realm: e.target.value || null },
                      e.target.value ? `${r.display_name} is now in ${e.target.value}.` : `${r.display_name} takes its first archetype's realm again.`
                    )}
                  >
                    <option value="">{first ? `Its archetype's (${getArchetype(first.slug)?.realm ?? "none"})` : "Its archetype's (none yet)"}</option>
                    {REALMS.map((realm) => <option key={realm} value={realm}>{realm}</option>)}
                  </Select>
                </div>
              </div>
              {others.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 sm:pl-7 list-none p-0" aria-label="Other archetypes">
                  {others.map((l) => (
                    <li key={l.slug} className="inline-flex items-center rounded-full border border-line text-xs text-ink-soft">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => change({ action: "primary", id: r.id, slug: l.slug }, `${nameOf(l.slug)} is now first for ${r.display_name}.`)}
                        className="pl-2.5 pr-1 py-0.5 min-h-6 hover:text-ink-strong"
                        title="Make this the first archetype"
                      >
                        {nameOf(l.slug)}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => change({ action: "remove", id: r.id, slug: l.slug }, `Took ${nameOf(l.slug)} off ${r.display_name}.`)}
                        className="pr-2 pl-1 py-0.5 min-h-6 min-w-6 inline-flex items-center justify-center text-ink-ghost hover:text-danger-ink"
                        aria-label={`Take ${nameOf(l.slug)} off ${r.display_name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {!loading && rows.length === 0 && !message && <p className="text-sm text-ink-faint">No concepts match.</p>}
      {rows.length < total && (
        <Button variant="quiet" disabled={loading} onClick={() => load(rows.length, true)}>Show more</Button>
      )}
    </div>
  );
}
