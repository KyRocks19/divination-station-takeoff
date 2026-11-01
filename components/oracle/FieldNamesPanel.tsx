"use client";

import { useId, useState } from "react";
import { fieldFullClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import type { OracleFieldName } from "@/lib/oracle";

/** Two field names are the same name when they differ only in capital letters or spaces around them. */
export const sameFieldName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface Props {
  /** The field names the person has used, most used first, each with how many items hold it. */
  names: OracleFieldName[];
  /** Reads the names again from the server: they change whenever any item is saved, here or in another tab. */
  refresh: () => Promise<OracleFieldName[] | null>;
  /** Called after a name was removed from every item, so a screen showing items can drop it too. */
  onRemoved: (name: string) => void;
  /** Called after a name was changed on every item. */
  onRenamed: (from: string, to: string) => void;
  /** What the things are called here: "item" on a card's page, "card" or "stone" on a set's page. */
  thing?: string;
}

const MAX_NAME = 100;

/**
 * Every field name the person has used, with how many items hold it. Each can be renamed or removed from all items at
 * once. Nothing is changed before a second step: a rename shows the new name first, a removal asks.
 */
export default function FieldNamesPanel({ names, refresh, onRemoved, onRenamed, thing = "item" }: Props) {
  const uid = useId();
  const [removing, setRemoving] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const things = `${thing}s`;

  function close() {
    setRemoving(null);
    setRenaming(null);
    setError(null);
  }

  // The counts are read again just before a question about every item, so the question shows today's number.
  async function askToRemove(name: string) {
    close();
    const list = await refresh();
    if (list && !list.some((f) => sameFieldName(f.name, name))) return; // it was already removed somewhere else
    setRemoving(name);
  }

  async function remove(name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/oracle/fields?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onRemoved(name);
      setRemoving(null);
      await refresh();
    } catch {
      setError("Could not remove the field name. Nothing was removed.");
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!renaming) return;
    const to = renaming.value.trim();
    if (!to || busy) return;
    if (to === renaming.name) {
      close();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/oracle/fields", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renaming.name, new_name: to }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "Could not rename the field. Nothing was changed.");
        return;
      }
      onRenamed(renaming.name, to);
      setRenaming(null);
      await refresh();
    } catch {
      setError("Could not rename the field. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  if (names.length === 0) return null;

  return (
    <div>
      <ul className="space-y-3 list-none p-0 m-0">
        {names.map((k) => (
          <li key={k.name} className="text-xs text-ink-muted">
            {removing !== null && sameFieldName(removing, k.name) ? (
              <span className="leading-relaxed">
                Remove &ldquo;{k.name}&rdquo; from {k.cards === 1 ? `its 1 ${thing}` : `all ${k.cards} ${things}`}? What you wrote in
                it is removed too. The {things} stay. This cannot be undone.{" "}
                <button type="button" onClick={() => remove(k.name)} disabled={busy} className="text-danger-ink hover:text-danger-soft">
                  {busy ? "Removing…" : "Yes, remove"}
                </button>{" "}
                <button type="button" onClick={close} className="text-ink-faint hover:text-ink-soft">
                  Cancel
                </button>
              </span>
            ) : renaming !== null && sameFieldName(renaming.name, k.name) ? (
              <span className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label htmlFor={`${uid}-rename-${k.name}`} className="sr-only">New name for the field &ldquo;{k.name}&rdquo;</label>
                <input
                  id={`${uid}-rename-${k.name}`}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ name: renaming.name, value: e.target.value })}
                  onKeyDown={(e) => {
                    // This panel can sit inside a form; Enter here renames, and must not save the form around it.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      rename();
                    } else if (e.key === "Escape") {
                      e.stopPropagation();
                      close();
                    }
                  }}
                  maxLength={MAX_NAME}
                  autoComplete="off"
                  autoFocus
                  className={`${fieldFullClass} sm:w-56`}
                />
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={rename}
                    disabled={busy || !renaming.value.trim()}
                    className={buttonClass.primary}
                  >
                    {busy ? "Renaming…" : `Rename on ${k.cards === 1 ? `its 1 ${thing}` : `all ${k.cards} ${things}`}`}
                  </button>
                  <button type="button" onClick={close} className={buttonClass.quiet}>Cancel</button>
                </span>
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="break-words">
                  {k.name} <span className="text-ink-ghost">(on {k.cards} {k.cards !== 1 ? things : thing})</span>
                </span>
                <button
                  type="button"
                  onClick={() => { close(); setRenaming({ name: k.name, value: k.name }); }}
                  className="text-tone-300 hover:text-tone-200"
                >
                  Rename<span className="sr-only"> {k.name} on all {things}</span>
                </button>
                <button type="button" onClick={() => askToRemove(k.name)} className="text-ink-ghost hover:text-danger-ink">
                  Remove from {k.cards === 1 ? `the ${thing}` : `all ${things}`}
                  <span className="sr-only">: {k.name}</span>
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="text-xs text-danger mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
