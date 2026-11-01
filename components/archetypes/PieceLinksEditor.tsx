"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/Page";
import { ARCHETYPES, REALMS } from "@/lib/archetypes-data";
import { BASES, BASIS_KEYS } from "@/lib/symbol-archetype-map";
import { BASIS_LABELS } from "@/lib/symbol-links-core";
import { MAX_STOCK_LINKS, MAX_STOCK_NOTE, type StockAspect, type StockPiece } from "@/lib/symbol-edit-shared";

interface Row {
  slug: string;
  aspect: StockAspect;
  basis: string;
}

const ASPECT_LABELS: Record<StockAspect, string> = {
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
 * Change which shared archetypes a piece of a tool (a rune, an ogham letter, a die face, a swing, a scrying surface) reaches.
 * The links are shared by every account and read by Patterns, so only an admin may save (the API refuses anyone else) and
 * each save is written to the admin log. The first link is the piece's main archetype. Nothing is saved until Save is pressed.
 */
export default function PieceLinksEditor({ pieces }: { pieces: StockPiece[] }) {
  const uid = useId();
  const groups = [...new Set(pieces.map((p) => p.group))];
  const [pieceId, setPieceId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Bumped by Undo to read the piece again.
  const [reload, setReload] = useState(0);

  // Load a piece's links when one is chosen.
  useEffect(() => {
    if (!pieceId) return;
    let cancelled = false;
    setLoaded(null);
    setError("");
    setMessage("");
    fetch(`/api/symbols/${encodeURIComponent(pieceId)}/archetypes`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((a: { links: { slug: string; aspect: StockAspect; basis: string | null }[]; note: string | null }) => {
        if (cancelled) return;
        setRows(a.links.map((l) => ({ slug: l.slug, aspect: l.aspect, basis: l.basis ?? "app" })));
        setNote(a.note ?? "");
        setDirty(false);
        setLoaded(pieceId);
      })
      .catch(() => !cancelled && setError("Could not load this piece. Nothing was changed."));
    return () => {
      cancelled = true;
    };
  }, [pieceId, reload]);

  const change = (fn: (r: Row[]) => Row[]) => {
    setRows(fn);
    setDirty(true);
    setMessage("");
  };
  const setRow = (i: number, patch: Partial<Row>) => change((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: -1 | 1) =>
    change((r) => {
      const j = i + by;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const used = new Set(rows.map((r) => r.slug));

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/symbols/${encodeURIComponent(pieceId)}/archetypes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: rows, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That did not save. Nothing was changed.");
      setDirty(false);
      setMessage(`Saved. This piece now reaches ${rows.length === 0 ? "no archetype" : rows.length === 1 ? "1 archetype" : `${rows.length} archetypes`}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  const piece = pieces.find((p) => p.id === pieceId);

  return (
    <div className="space-y-4">
      <Field
        htmlFor={`${uid}-piece`}
        label="Piece"
        hint={dirty ? "Save or undo your changes before choosing another piece." : undefined}
      >
        <Select id={`${uid}-piece`} value={pieceId} disabled={dirty} onChange={(e) => setPieceId(e.target.value)}>
          <option value="">Choose a rune, letter, die face, swing or surface…</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {pieces.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      {pieceId && loaded !== pieceId && !error && <p className="text-sm text-ink-faint">Loading…</p>}

      {pieceId && loaded === pieceId && (
        <div className="space-y-4">
          {rows.length === 0 && <p className="text-sm text-ink-muted">No archetype is matched to {piece?.name ?? "this piece"} at the moment.</p>}

          <ol className="space-y-3 list-none p-0">
            {rows.map((r, i) => (
              <li key={`${i}-${r.slug}`}>
                <fieldset className="border border-line rounded-card p-3 space-y-2">
                  <legend className="px-1 text-xs text-ink-faint">{i === 0 ? "Link 1 (the main one)" : `Link ${i + 1}`}</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field htmlFor={`${uid}-a${i}`} label="Archetype">
                      <Select id={`${uid}-a${i}`} value={r.slug} onChange={(e) => setRow(i, { slug: e.target.value })}>
                        <ArchetypeOptions />
                      </Select>
                    </Field>
                    <Field htmlFor={`${uid}-s${i}`} label="Side">
                      <Select id={`${uid}-s${i}`} value={r.aspect} onChange={(e) => setRow(i, { aspect: e.target.value as StockAspect })}>
                        {(Object.keys(ASPECT_LABELS) as StockAspect[]).map((a) => (
                          <option key={a} value={a}>{ASPECT_LABELS[a]}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field htmlFor={`${uid}-b${i}`} label="Drawn from">
                      <Select id={`${uid}-b${i}`} value={r.basis} onChange={(e) => setRow(i, { basis: e.target.value })}>
                        {BASIS_KEYS.map((b) => (
                          <option key={b} value={b}>{BASIS_LABELS[b] ?? b}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <p className="text-[11px] text-ink-faint leading-relaxed">{(BASES as Record<string, string>)[r.basis]}</p>
                  <div className="flex flex-wrap gap-x-2">
                    <Button variant="text" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up, link ${i + 1}`}>Move up</Button>
                    <Button variant="text" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move down, link ${i + 1}`}>Move down</Button>
                    <Button variant="danger" onClick={() => change((all) => all.filter((_, k) => k !== i))} aria-label={`Remove, link ${i + 1}`}>Remove</Button>
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>

          <Button
            variant="quiet"
            disabled={rows.length >= MAX_STOCK_LINKS}
            onClick={() => {
              const next = ARCHETYPES.find((a) => !used.has(a.slug));
              if (next) change((all) => [...all, { slug: next.slug, aspect: "neutral", basis: "app" }]);
            }}
          >
            Add an archetype
          </Button>

          <Field
            htmlFor={`${uid}-note`}
            label="Note"
            hint={rows.length === 0 ? "Required while the piece has no archetype: say why." : "How the links were reached (optional)."}
          >
            <Textarea
              id={`${uid}-note`}
              value={note}
              rows={3}
              maxLength={MAX_STOCK_NOTE}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
                setMessage("");
              }}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || !dirty || (rows.length === 0 && !note.trim())} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button variant="quiet" disabled={busy || !dirty} onClick={() => setReload((n) => n + 1)}>Undo changes</Button>
            <p role="status" className="text-sm text-ink-muted">{message}</p>
          </div>
        </div>
      )}
      {error && <ErrorNote role="alert">{error}</ErrorNote>}
    </div>
  );
}
