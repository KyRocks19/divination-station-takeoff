"use client";

import { FEATHERED } from "@/lib/edition";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BOARD_CARD_H, BOARD_CARD_W, MAX_POSITIONS, blankPosition, type EditablePosition } from "@/lib/layouts-shared";
import { POSITION_COLORS } from "@/lib/position-colors";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/Page";
import BoardEditor from "./BoardEditor";
import { styleRef } from "@/lib/apply-style";

export interface EditableLayout {
  id: number | null;
  name: string;
  description: string;
  question: string;
  positions: EditablePosition[];
}

interface Props {
  initial: EditableLayout;
}

/** A starting place for a position when a person turns the board on: rows of five, in order. */
function startingPlace(i: number) {
  const perRow = 5;
  return { x: 24 + (i % perRow) * (BOARD_CARD_W + 24), y: 24 + Math.floor(i / perRow) * (BOARD_CARD_H + 48) };
}

/**
 * Makes or changes one layout: a name, an optional description and starting question, and ordered named positions.
 * Each position can have its own colour and, when the board is on, a place on it (drag it, turn it sideways).
 */
export default function LayoutEditor({ initial }: Props) {
  const router = useRouter();
  const nameId = useId();
  const descId = useId();
  const questionId = useId();
  const boardId = useId();
  const gridId = useId();
  const [layout, setLayout] = useState(initial);
  const [grid, setGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onBoard = layout.positions.length > 0 && layout.positions.every((p) => p.x !== null && p.y !== null);

  function change(patch: Partial<EditableLayout>) {
    setLayout((l) => ({ ...l, ...patch }));
    setSaved(false);
  }

  function changePosition(i: number, patch: Partial<EditablePosition>) {
    change({ positions: layout.positions.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  }

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= layout.positions.length) return;
    const positions = [...layout.positions];
    [positions[i], positions[j]] = [positions[j], positions[i]];
    change({ positions });
  }

  function setBoard(on: boolean) {
    change({
      positions: layout.positions.map((p, i) =>
        on ? { ...p, ...(p.x === null || p.y === null ? { ...startingPlace(i), rotation: p.rotation ?? 0 } : {}) } : { ...p, x: null, y: null, rotation: null }
      ),
    });
  }

  function addPosition() {
    const next = layout.positions.length;
    change({ positions: [...layout.positions, onBoard ? { ...blankPosition(), ...startingPlace(next), rotation: 0 } : blankPosition()] });
  }

  async function suggestColors() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/layouts/suggest-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: layout.positions.map((p) => ({ name: p.name, description: p.prompt })) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.colors)) throw new Error(typeof body?.error === "string" ? body.error : "");
      change({ positions: layout.positions.map((p, i) => ({ ...p, color: body.colors[i] ?? p.color })) });
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not suggest colours. You can still choose them yourself.");
    } finally {
      setSuggesting(false);
    }
  }

  const ready = layout.name.trim() !== "" && layout.positions.length > 0 && layout.positions.every((p) => p.name.trim() !== "");
  const anyNamed = layout.positions.some((p) => p.name.trim() !== "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(layout.id ? `/api/layouts/${layout.id}` : "/api/layouts", {
        method: layout.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      const result = await res.json();
      if (!layout.id) {
        router.push(`/layouts/${result.id}`);
        return;
      }
      setSaved(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not save. Your changes are still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!layout.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/layouts/${layout.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/layouts");
    } catch {
      setError("Could not delete the layout. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="bg-surface border border-line rounded-card p-5 space-y-4">
        <div>
          <label htmlFor={nameId} className="block text-xs text-ink-faint mb-1">Name of the layout</label>
          <input id={nameId} value={layout.name} onChange={(e) => change({ name: e.target.value })} maxLength={120} className={fieldFullClass} />
        </div>
        <div>
          <label htmlFor={descId} className="block text-xs text-ink-faint mb-1">What it is for (optional)</label>
          <textarea id={descId} value={layout.description} onChange={(e) => change({ description: e.target.value })} rows={2} className={`${fieldFullClass} resize-y leading-relaxed`} />
        </div>
        <div>
          <label htmlFor={questionId} className="block text-xs text-ink-faint mb-1">
            A starting question for draws with this layout (optional)
          </label>
          <textarea id={questionId} value={layout.question} onChange={(e) => change({ question: e.target.value })} rows={2} className={`${fieldFullClass} resize-y leading-relaxed`} />
        </div>
      </div>

      <section aria-label="Positions" className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel>Positions ({layout.positions.length})</SectionLabel>
          {/* Claude suggests the colours, so the Feathered edition leaves the button out. */}
          {!FEATHERED && (
            <button type="button" onClick={suggestColors} disabled={suggesting || !anyNamed} className={buttonClass.text}>
              {suggesting ? "Suggesting…" : "Suggest colours from the names"}
            </button>
          )}
        </div>
        <ol className="list-none p-0 space-y-3">
          {layout.positions.map((p, i) => (
            <li key={i} className="bg-surface border border-line rounded-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-ghost w-6 flex-shrink-0">{i + 1}.</span>
                <input
                  value={p.name}
                  onChange={(e) => changePosition(i, { name: e.target.value })}
                  aria-label={`Name of position ${i + 1}`}
                  maxLength={120}
                  className={fieldFullClass}
                />
              </div>
              <textarea
                value={p.prompt}
                onChange={(e) => changePosition(i, { prompt: e.target.value })}
                aria-label={`Your question for position ${i + 1} (optional)`}
                placeholder="Your own question for this position (optional)"
                rows={2}
                className={`${fieldFullClass} resize-y leading-relaxed`}
              />
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Colour for position ${i + 1} (optional)`}>
                <span className="text-xs text-ink-faint mr-1">Colour</span>
                <button
                  type="button"
                  onClick={() => changePosition(i, { color: "" })}
                  aria-pressed={p.color === ""}
                  aria-label="No colour"
                  title="No colour"
                  className={`w-6 h-6 max-sm:w-11 max-sm:h-11 rounded-full border border-dashed text-[10px] text-ink-faint ${p.color === "" ? "border-line-accent ring-2 ring-focus" : "border-line-strong"}`}
                >
                  ∅
                </button>
                {POSITION_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => changePosition(i, { color: c.hex })}
                    aria-pressed={p.color.toLowerCase() === c.hex}
                    aria-label={`${c.id}: ${c.label}`}
                    title={c.label}
                    ref={styleRef({ backgroundColor: c.hex })}
                    className={`w-6 h-6 max-sm:w-11 max-sm:h-11 rounded-full border border-line-strong ${p.color.toLowerCase() === c.hex ? "ring-2 ring-offset-2 ring-offset-surface ring-ink-strong" : ""}`}
                  />
                ))}
                <input
                  type="color"
                  value={p.color || "#94a3b8"}
                  onChange={(e) => changePosition(i, { color: e.target.value })}
                  aria-label={`Pick any colour for position ${i + 1}`}
                  className="w-8 h-6 max-sm:w-11 max-sm:h-11 bg-transparent border border-line-strong rounded cursor-pointer"
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={buttonClass.text} aria-label={`Move position ${i + 1} up`}>Up</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === layout.positions.length - 1} className={buttonClass.text} aria-label={`Move position ${i + 1} down`}>Down</button>
                {onBoard && (
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.rotation === 90}
                      onChange={(e) => changePosition(i, { rotation: e.target.checked ? 90 : 0 })}
                      className="accent-tone-600"
                    />
                    Lies sideways
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => change({ positions: layout.positions.filter((_, j) => j !== i) })}
                  disabled={layout.positions.length === 1}
                  className={buttonClass.danger}
                  aria-label={`Remove position ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={addPosition} disabled={layout.positions.length >= MAX_POSITIONS} className={buttonClass.text}>
          Add a position
        </button>
      </section>

      <section aria-label="Board" className="space-y-3">
        <SectionLabel>Board (optional)</SectionLabel>
        <label htmlFor={boardId} className="flex items-start gap-2 text-sm text-ink-muted cursor-pointer leading-relaxed">
          <input id={boardId} type="checkbox" checked={onBoard} onChange={(e) => setBoard(e.target.checked)} className="accent-tone-600 mt-1" />
          <span>
            Lay this out on a board, with each position where you put it, like the Celtic Cross, instead of in a row.
            Cards that share a spot lie on top of each other, and one can lie sideways across another.
          </span>
        </label>
        {onBoard && (
          <>
            <label htmlFor={gridId} className="flex items-start gap-2 text-sm text-ink-muted cursor-pointer leading-relaxed">
              <input id={gridId} type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} className="accent-tone-600 mt-1" />
              <span>Snap to a grid. Each step is a quarter of a card, across and down; with the arrow keys, Shift moves a whole card.</span>
            </label>
            <BoardEditor
              positions={layout.positions}
              onMove={(i, x, y) => changePosition(i, { x, y })}
              grid={grid}
            />
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !ready} className={buttonClass.primary}>
          {busy ? "Saving…" : layout.id ? "Save changes" : "Make this layout"}
        </button>
        <Link href="/layouts" className="text-sm text-ink-faint hover:text-ink-soft px-3 py-2 min-h-11 sm:min-h-0 inline-flex items-center">Back to your layouts</Link>
        {saved && <span className="text-xs text-tone-400" role="status">Saved.</span>}
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {layout.id && (
        <div className="border-t border-line-faint pt-4">
          {confirmDelete ? (
            <p className="text-xs text-ink-muted leading-relaxed">
              Delete this layout? Readings already made with it keep its name, their position names, colours, and places. This cannot be undone.{" "}
              <button type="button" onClick={remove} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                {busy ? "Deleting…" : "Yes, delete"}
              </button>{" "}
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">Cancel</button>
            </p>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this layout</button>
          )}
        </div>
      )}
    </form>
  );
}
