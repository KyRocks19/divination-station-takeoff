"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getArchetype } from "@/lib/archetypes-data";
import { BASES, type Basis } from "@/lib/symbol-archetype-map";
import { BASIS_LABELS } from "@/lib/symbol-links-core";
import ArchetypeChips from "@/components/ArchetypeChips";
import { Button } from "@/components/ui/Button";

interface Link_ {
  slug: string;
  name: string;
  aspect: "light" | "shadow" | "neutral";
  basis: string | null;
  primary: boolean;
  /** True when this person hid the link for themselves (migration 073). */
  hidden?: boolean;
}
interface Answer {
  recorded: boolean;
  links: Link_[];
  note: string | null;
}

interface Props {
  /** The piece's id, for example "rune-fehu". */
  symbolId: string;
  /** The older mapping in code, shown when the database has nothing for this piece or cannot be reached. */
  slugs: string[];
}

/**
 * The shared archetypes of one piece, each with what the link was drawn from (an old poem, the letter's name, modern
 * practice, ...), a mark on a link that names the hard side, and the piece's own note, which says why it has no
 * archetype where that is a decision. Age is information, not rank. The links are stock text, never the person's own.
 * A person can hide a link for themselves and show it again; that changes nothing for anyone else.
 */
export default function SymbolArchetypes({ symbolId, slugs }: Props) {
  const [answer, setAnswer] = useState<Answer | "failed" | null>(null);
  const [said, setSaid] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/symbols/${encodeURIComponent(symbolId)}/archetypes`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((a: Answer) => !cancelled && setAnswer(a))
      .catch(() => !cancelled && setAnswer("failed"));
    return () => {
      cancelled = true;
    };
  }, [symbolId]);

  if (answer === null) return <p className="text-xs text-ink-ghost">Looking up the archetypes…</p>;
  // Nothing recorded (or no way to ask): the older mapping, which does not say what its links were drawn from.
  if (answer === "failed" || !answer.recorded) return <ArchetypeChips slugs={slugs} />;

  const everyLink = answer.links.filter((l) => getArchetype(l.slug));
  const shown = everyLink.filter((l) => !l.hidden);
  const bases = [...new Set(shown.map((l) => l.basis).filter((b): b is Basis => !!b && b in BASES))];

  async function setHidden(slug: string, name: string, hidden: boolean) {
    try {
      const res = await fetch(`/api/symbols/${encodeURIComponent(symbolId)}/hidden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, hidden }),
      });
      if (!res.ok) throw new Error(`hide ${res.status}`);
      setAnswer((a) => (a && a !== "failed" ? { ...a, links: a.links.map((l) => (l.slug === slug ? { ...l, hidden } : l)) } : a));
      setSaid(hidden ? `${name} is hidden for you. Everyone else still sees it.` : `${name} is showing again.`);
    } catch (err) {
      console.error(err);
      setSaid("That did not work. Nothing was changed.");
    }
  }

  return (
    <div className="space-y-2">
      {shown.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Archetypes">
          {shown.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/archetypes/${l.slug}`}
                title={l.basis ? `Drawn from: ${BASIS_LABELS[l.basis] ?? l.basis}` : undefined}
                className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong"
              >
                {l.name}
                {l.aspect === "shadow" && <span className="text-ink-ghost"> · hard side</span>}
                {l.basis && <span className="text-ink-ghost"> · {BASIS_LABELS[l.basis] ?? l.basis}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : everyLink.length > 0 ? (
        <p className="text-sm text-ink-faint">You have hidden every shared archetype of this one.</p>
      ) : (
        <p className="text-sm text-ink-faint">No archetype is matched to this one, on purpose.</p>
      )}
      {everyLink.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-faint hover:text-ink-soft">Hide or show these for you</summary>
          <ul className="mt-1 list-none p-0 space-y-0.5">
            {everyLink.map((l) => (
              <li key={l.slug} className="flex flex-wrap items-center gap-x-2">
                <span className={l.hidden ? "text-ink-ghost" : "text-ink-soft"}>
                  {l.name}
                  {l.hidden && " (hidden)"}
                </span>
                <Button variant="text" className="min-h-6" onClick={() => setHidden(l.slug, l.name, !l.hidden)}>
                  {l.hidden ? `Show ${l.name} again` : `Hide ${l.name}`}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-ink-ghost">Only you are affected: the link stays for everyone else. Hidden links are left out of your Patterns too.</p>
        </details>
      )}
      <p role="status" className="text-[11px] text-ink-faint empty:hidden">{said}</p>
      {answer.note && <p className="text-[11px] text-ink-faint leading-relaxed">{answer.note}</p>}
      {bases.length > 0 && (
        <ul className="list-none p-0 space-y-0.5">
          {bases.map((b) => (
            <li key={b} className="text-[11px] text-ink-ghost">
              <span className="text-ink-faint">{BASIS_LABELS[b]}:</span> {BASES[b]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
