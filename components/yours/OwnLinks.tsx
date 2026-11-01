"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { ARCHETYPES } from "@/lib/archetypes-data";

interface OwnLink {
  id: number;
  target: { kind: "archetype"; slug: string; name: string } | { kind: "user_archetype"; id: number; name: string } | { kind: "user_concept"; id: number; name: string };
  aspect: "light" | "shadow" | "neutral";
}
interface Mine {
  archetypes: { id: number; name: string }[];
  concepts: { id: number; name: string }[];
}

const SIDE_LABEL = { light: "good side", shadow: "hard side", neutral: "either" } as const;
const KIND_LABEL = { archetype: "shared archetype", user_archetype: "yours", user_concept: "your concept" } as const;
const SHARED = [...ARCHETYPES].sort((a, b) => a.name.localeCompare(b.name));

/** The value of a target in the choice list, and back. */
const valueOf = (t: OwnLink["target"]) => (t.kind === "archetype" ? `a:${t.slug}` : t.kind === "user_archetype" ? `u:${t.id}` : `c:${t.id}`);

interface Props {
  /** A shared piece's id ("rune-fehu", "major-0"). */
  symbolId?: string;
  /** Or one of the person's own oracle items. */
  oracleCardId?: number;
}

/**
 * The person's own links from one piece to archetypes and concepts: shared archetypes, ones they made, and concepts they
 * made. Private to them, always shown apart from the app's own matches. Nothing is added unless they press Add.
 */
export default function OwnLinks({ symbolId, oracleCardId }: Props) {
  const uid = useId();
  const query = symbolId ? `symbol_id=${encodeURIComponent(symbolId)}` : `oracle_card_id=${oracleCardId}`;
  const [links, setLinks] = useState<OwnLink[] | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState("");
  const [aspect, setAspect] = useState<"neutral" | "light" | "shadow">("neutral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPiece = !!symbolId || !!oracleCardId;
  const loadLinks = useCallback(async () => {
    if (!hasPiece) return;
    try {
      const res = await fetch(`/api/own/links?${query}`);
      setLinks(res.ok ? await res.json() : []);
    } catch {
      setLinks([]);
    }
  }, [query, hasPiece]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  async function openAdd() {
    setAdding(true);
    setError(null);
    if (!mine) {
      try {
        const [a, c] = await Promise.all([fetch("/api/own/archetypes"), fetch("/api/own/concepts")]);
        setMine({ archetypes: a.ok ? await a.json() : [], concepts: c.ok ? await c.json() : [] });
      } catch {
        setMine({ archetypes: [], concepts: [] });
      }
    }
  }

  async function add() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const [kind, id] = [target[0], target.slice(2)];
    const body: Record<string, unknown> = { aspect };
    if (symbolId) body.symbol_id = symbolId; else body.oracle_card_id = oracleCardId;
    if (kind === "a") body.archetype = id;
    else if (kind === "u") body.user_archetype_id = Number(id);
    else body.user_concept_id = Number(id);
    try {
      const res = await fetch("/api/own/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "That could not be added.");
      setTarget("");
      setAspect("neutral");
      setAdding(false);
      await loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(link: OwnLink) {
    setError(null);
    const res = await fetch(`/api/own/links/${link.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setError("That could not be removed. Nothing was changed.");
      return;
    }
    await loadLinks();
  }

  const taken = new Set((links ?? []).map((l) => valueOf(l.target)));
  const noneOfMine = mine && mine.archetypes.length === 0 && mine.concepts.length === 0;

  // A piece with no id (which should not happen) has nothing to link.
  if (!hasPiece) return null;

  return (
    <div role="group" aria-labelledby={`${uid}-h`} className="bg-surface rounded-xl p-4 border border-line space-y-3">
      <p id={`${uid}-h`} className="text-[10px] text-tone-300 uppercase tracking-widest">Your archetypes and concepts</p>

      {links === null ? (
        <p className="text-xs text-ink-ghost">Looking…</p>
      ) : links.length === 0 && !adding ? (
        <p className="text-sm text-ink-faint italic">You have not linked this to anything of your own yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 list-none p-0" aria-label="Your links">
          {links.map((l) => (
            <li key={l.id} className="inline-flex items-center rounded-full border border-line text-xs text-ink-soft">
              <Link
                href={l.target.kind === "archetype" ? `/archetypes/${l.target.slug}` : "/archetypes"}
                className="pl-2.5 pr-1.5 py-0.5 hover:text-ink-strong"
              >
                {l.target.name}
                <span className="text-ink-ghost"> · {KIND_LABEL[l.target.kind]}{l.aspect !== "neutral" ? `, ${SIDE_LABEL[l.aspect]}` : ""}</span>
              </Link>
              <button
                type="button"
                onClick={() => remove(l)}
                aria-label={`Remove your link to ${l.target.name}`}
                className="pr-2 pl-0.5 py-0.5 text-ink-ghost hover:text-danger-ink"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-2">
          {mine === null ? (
            <p className="text-xs text-ink-ghost">Looking…</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div>
                  <label htmlFor={`${uid}-t`} className="block text-xs text-ink-faint mb-1">Link to</label>
                  <Select id={`${uid}-t`} value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">Choose…</option>
                    {mine.archetypes.length > 0 && (
                      <optgroup label="Your archetypes">
                        {mine.archetypes.map((a) => <option key={a.id} value={`u:${a.id}`} disabled={taken.has(`u:${a.id}`)}>{a.name}</option>)}
                      </optgroup>
                    )}
                    {mine.concepts.length > 0 && (
                      <optgroup label="Your concepts">
                        {mine.concepts.map((c) => <option key={c.id} value={`c:${c.id}`} disabled={taken.has(`c:${c.id}`)}>{c.name}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="Shared archetypes">
                      {SHARED.map((a) => <option key={a.slug} value={`a:${a.slug}`} disabled={taken.has(`a:${a.slug}`)}>{a.name}</option>)}
                    </optgroup>
                  </Select>
                </div>
                <div>
                  <label htmlFor={`${uid}-s`} className="block text-xs text-ink-faint mb-1">Side</label>
                  <Select id={`${uid}-s`} value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)}>
                    <option value="neutral">Either</option>
                    <option value="light">Good side</option>
                    <option value="shadow">Hard side</option>
                  </Select>
                </div>
              </div>
              {noneOfMine && (
                <p className="text-xs text-ink-faint">
                  You have not made any archetypes or concepts of your own yet. You can make them on the{" "}
                  <Link href="/archetypes" className="text-accent-ink hover:text-accent-ink-hover">Archetypes page</Link>.
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={add} disabled={!target || busy}>{busy ? "Adding…" : "Add"}</Button>
                <Button variant="quiet" onClick={() => { setAdding(false); setError(null); }}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button type="button" onClick={openAdd} className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">
          {links && links.length > 0 ? "Link it to something else" : "Link it to an archetype or concept"}
        </button>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      <p className="text-[11px] text-ink-ghost leading-relaxed">Only you can see these. They are not mixed in with the app&rsquo;s own archetypes.</p>
    </div>
  );
}
