import Link from "next/link";
import { getArchetype } from "@/lib/archetypes-data";

/** The names of a symbol's archetypes as links to the archetype pages. Used under every common meaning. */
export default function ArchetypeChips({ slugs }: { slugs: string[] }) {
  const items = slugs.map((s) => getArchetype(s)).filter((a): a is NonNullable<typeof a> => !!a);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Archetypes">
      {items.map((a) => (
        <li key={a.slug}>
          <Link
            href={`/archetypes/${a.slug}`}
            className="inline-flex items-center min-h-11 sm:min-h-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong"
          >
            {a.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
