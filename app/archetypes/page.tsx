import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ARCHETYPES, REALMS } from "@/lib/archetypes-data";
import { conceptCounts, symbolCounts } from "@/lib/archetype-reads";
import { BackLink, JumpLinks, PageTitle, SectionLabel } from "@/components/ui/Page";
import { CardLink } from "@/components/ui/Card";
import YourArchetypes, { type LinkedPiece } from "@/components/yours/YourArchetypes";
import { allOwnLinks, listOwnArchetypes, listOwnConcepts } from "@/lib/own-archetypes";
import { oracleItemHref, symbolLabel } from "@/lib/piece-labels";

export const metadata = { title: "Archetypes" };

/** The person's own archetypes, concepts and what they linked to each. */
async function loadYours(userId: number) {
  const [archetypes, concepts, links] = await Promise.all([listOwnArchetypes(userId), listOwnConcepts(userId), allOwnLinks(userId)]);
  const pieces: Record<string, LinkedPiece[]> = {};
  for (const l of links) {
    if (l.target.kind === "archetype") continue;
    const label =
      l.piece.kind === "symbol"
        ? symbolLabel(l.piece.id)
        : { name: `${l.piece.name ?? "Oracle item"} (your oracle item)`, href: oracleItemHref(l.piece.id) };
    if (!label) continue;
    const key = `${l.target.kind === "user_archetype" ? "a" : "c"}:${l.target.id}`;
    (pieces[key] ??= []).push({ ...label, side: l.aspect });
  }
  return { archetypes, concepts, pieces };
}

export default async function ArchetypesPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const [concepts, symbols, yours] = await Promise.all([conceptCounts(), symbolCounts(session.userId), loadYours(session.userId)]);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-12 space-y-6">
      <div className="space-y-1">
        <BackLink href="/library">← The Library</BackLink>
        <PageTitle>Archetypes</PageTitle>
      </div>
      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        Every tool in the app speaks about the same human things: starting, losing, choosing, resting, loving. An archetype
        is one of those things. A tarot card, a rune, a die face, and a pendulum swing can each touch the same archetype,
        so you can see what they share. Each archetype has a side that goes well and a side that is hard, because both are
        part of living it. These are starting words. Your own words on any symbol always come first.
      </p>
      <p className="text-xs text-ink-faint">
        <Link href="/archetypes/review" className="underline hover:text-ink-soft">Review how the tarot concepts are sorted</Link>
        {" · "}
        <Link href="/insights" className="underline hover:text-ink-soft">Patterns</Link> uses these archetypes to show what
        keeps coming up in your readings.
      </p>

      <JumpLinks items={REALMS.map((realm, i) => ({ id: `realm-${i}`, label: realm }))} />

      <YourArchetypes archetypes={yours.archetypes} concepts={yours.concepts} pieces={yours.pieces} />

      {REALMS.map((realm, i) => {
        const items = ARCHETYPES.filter((a) => a.realm === realm);
        return (
          <section key={realm} id={`realm-${i}`} aria-label={realm} className="space-y-3">
            <SectionLabel>{realm}</SectionLabel>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
              {items.map((a) => (
                <li key={a.slug}>
                  <CardLink href={`/archetypes/${a.slug}`} lift className="h-full">
                    <p className="font-medium text-ink-strong break-words">{a.name}</p>
                    <p className="text-xs text-ink-faint mt-1 line-clamp-2 break-words">{a.summary}</p>
                    <p className="text-[11px] text-ink-ghost mt-2">
                      {concepts[a.slug] ?? 0} tarot concepts · {symbols[a.slug] ?? 0} symbols in other tools
                    </p>
                  </CardLink>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
