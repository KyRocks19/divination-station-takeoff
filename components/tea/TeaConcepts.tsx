import Link from "next/link";
import { getArchetype } from "@/lib/archetypes-data";
import { TEA_WORDS, getTea, type TeaKind } from "@/lib/tea-core";

/**
 * A chosen tea's leaves, why someone might choose it, and the concepts to bring to mind, each a link to its page in the shared archetypes.
 * On the form the links open in a new tab, so the question being typed is not lost.
 */
export default function TeaConcepts({ tea, newTab = false }: { tea: TeaKind; newTab?: boolean }) {
  const t = getTea(tea);
  const concepts = t.concepts.map((slug) => getArchetype(slug)).filter((a) => a !== undefined);
  return (
    <div className="rounded-control border border-line-faint bg-surface-sunken p-3 space-y-2" aria-live="polite">
      <p className="text-sm text-ink-soft leading-relaxed">
        <span className="font-medium text-ink-strong">{t.label}.</span> {t.leaves}
      </p>
      <p className="text-sm text-ink-muted leading-relaxed">{t.mindset}</p>
      {concepts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-ink-faint">{TEA_WORDS.concepts}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 list-none p-0 text-sm">
            {concepts.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/archetypes/${a.slug}`}
                  className="text-accent-ink hover:text-accent-ink-hover underline"
                  {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
                >
                  {a.name}
                  {newTab && <span className="sr-only"> (opens in a new tab)</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
