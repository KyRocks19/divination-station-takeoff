"use client";

import { useId } from "react";
import Link from "next/link";

/** What a draw form needs to know about one of the person's layouts. */
export interface LayoutChoice {
  id: number;
  name: string;
  question: string | null;
  positions: { name: string; prompt: string | null }[];
}

interface Props {
  layouts: LayoutChoice[];
  /** The chosen layout's id, or null for no layout. */
  value: number | null;
  onChange: (layout: LayoutChoice | null) => void;
  /** How many different items the set can give. A layout with more positions than this cannot be used. */
  setSize: number;
  /** What is drawn, for the messages: "runes", "staves", or "cards". */
  things: string;
}

/**
 * A choice of the person's own layout for a draw. With a layout, one item is drawn for each position, so the form
 * no longer asks how many. The app supplies no layouts; the link opens the page where the person makes their own.
 */
export default function LayoutPicker({ layouts, value, onChange, setSize, things }: Props) {
  const selectId = useId();
  const chosen = layouts.find((l) => l.id === value) ?? null;

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-xs text-ink-faint">Layout (optional)</label>
      <select
        id={selectId}
        value={value ?? ""}
        onChange={(e) => onChange(layouts.find((l) => l.id === Number(e.target.value)) ?? null)}
        className="w-full bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong focus:outline-none focus:border-focus"
      >
        <option value="">No layout</option>
        {layouts.map((l) => (
          <option key={l.id} value={l.id} disabled={l.positions.length > setSize}>
            {l.name} ({l.positions.length} position{l.positions.length !== 1 ? "s" : ""}
            {l.positions.length > setSize ? `, more than the ${setSize} ${things} available` : ""})
          </option>
        ))}
      </select>
      {chosen && (
        <ol className="list-decimal pl-5 text-xs text-ink-muted space-y-0.5">
          {chosen.positions.slice(0, 12).map((p, i) => (
            <li key={i} className="break-words">{p.name}</li>
          ))}
        </ol>
      )}
      {chosen && chosen.positions.length > 12 && (
        <p className="text-xs text-ink-faint">…and {chosen.positions.length - 12} more positions.</p>
      )}
      <p className="text-xs text-ink-ghost">
        <Link href="/layouts" className="text-tone-400 hover:text-tone-300">
          {layouts.length === 0 ? "Make a layout of your own" : "Your layouts"}
        </Link>
      </p>
    </div>
  );
}
