import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getArchetype } from "@/lib/archetypes-data";
import { symbolsForArchetype, tarotForArchetype } from "@/lib/archetype-reads";
import { showsSensitive } from "@/lib/concept-visibility";
import { BackLink, PageTitle, SectionLabel } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { BASES, type Basis } from "@/lib/symbol-archetype-map";
import { BASIS_LABELS } from "@/lib/symbol-links-core";
import { allOwnLinks } from "@/lib/own-archetypes";
import { oracleItemHref, symbolLabel } from "@/lib/piece-labels";
import { TakesList } from "@/components/DivinationTakes";
import { DIVINATION_SLUG } from "@/lib/divination-takes-core";
import { hiddenTakeIds, keptTakeIds, listOwnTakes } from "@/lib/divination-takes";

/** The pieces this person linked to this shared archetype themselves. */
async function ownPieces(userId: number, slug: string) {
  const out: { name: string; href: string; side: "light" | "shadow" | "neutral" }[] = [];
  for (const l of await allOwnLinks(userId)) {
    if (l.target.kind !== "archetype" || l.target.slug !== slug) continue;
    const label =
      l.piece.kind === "symbol" ? symbolLabel(l.piece.id) : { name: `${l.piece.name ?? "Oracle item"} (your oracle item)`, href: oracleItemHref(l.piece.id) };
    if (label) out.push({ ...label, side: l.aspect });
  }
  return out;
}

export default async function ArchetypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const archetype = getArchetype(slug);
  if (!archetype) notFound();

  const symbols = await symbolsForArchetype(slug, session.userId);
  const yours = await ownPieces(session.userId, slug);
  const { concepts, cards } = await tarotForArchetype(slug, await showsSensitive(session.userId));
  const light = concepts.filter((c) => c.aspect === "light");
  const shadow = concepts.filter((c) => c.aspect === "shadow");
  const neutral = concepts.filter((c) => c.aspect === "neutral");

  // The bases that appear in this list, so a short note can say what each small label means.
  const basesShown = [...new Set(symbols.map((s) => s.basis).filter((b): b is Basis => !!b && b in BASES))];

  const byTool = new Map<string, typeof symbols>();
  for (const s of symbols) byTool.set(s.toolName, [...(byTool.get(s.toolName) ?? []), s]);

  const conceptList = (items: typeof concepts) => (
    <ul className="flex flex-wrap gap-1.5 list-none p-0">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/encyclopedia/${encodeURIComponent(c.name)}`}
            className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong"
          >
            {c.display_name}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-12 space-y-6">
      <div className="space-y-1">
        <BackLink href="/archetypes">← Archetypes</BackLink>
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">{archetype.realm}</p>
        <PageTitle>{archetype.name}</PageTitle>
      </div>
      <p className="text-sm text-ink-soft leading-relaxed">{archetype.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-[10px] text-tone-400 uppercase tracking-widest mb-1">When it goes well</p>
          <p className="text-sm text-ink-soft leading-relaxed">{archetype.light}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-tone-400 uppercase tracking-widest mb-1">When it is hard</p>
          <p className="text-sm text-ink-soft leading-relaxed">{archetype.shadow}</p>
        </Card>
      </div>
      <p className="text-[11px] text-ink-faint">
        These are starting words, written for the app. They are not the last word on any of it, and your own words on a
        card or symbol come first.
      </p>

      {slug === DIVINATION_SLUG && (
        <section aria-labelledby="takes-heading" className="space-y-2">
          <SectionLabel id="takes-heading">Takes on divination</SectionLabel>
          <p className="text-xs text-ink-faint">
            The home page shows one of these each time it opens. Some are playful, some are a believer&rsquo;s view, some a
            skeptic&rsquo;s. Write your own, and keep the ones that say something true for you: your own come round on the home page
            too, and only you can see them. Hide any you do not want to see again; you can show them again here.
          </p>
          <TakesList kept={await keptTakeIds(session.userId)} hidden={await hiddenTakeIds(session.userId)} own={await listOwnTakes(session.userId)} />
        </section>
      )}

      <section aria-label="Tarot" className="space-y-3">
        <SectionLabel>In tarot</SectionLabel>
        {cards.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-faint">Cards that carry this archetype most:</p>
            <ul className="flex flex-wrap gap-1.5 list-none p-0">
              {cards.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/cards/${encodeURIComponent(c.id)}`}
                    className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong"
                  >
                    {c.name} <span className="text-ink-ghost">· {c.light + c.shadow}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {light.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-faint">Concepts on the side that goes well ({light.length})</p>
            {conceptList(light)}
          </div>
        )}
        {shadow.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-faint">Concepts on the hard side ({shadow.length})</p>
            {conceptList(shadow)}
          </div>
        )}
        {neutral.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-faint">Concepts that go either way ({neutral.length})</p>
            {conceptList(neutral)}
          </div>
        )}
        {concepts.length === 0 && <p className="text-sm text-ink-faint">No tarot concepts sit under this archetype yet.</p>}
      </section>

      {yours.length > 0 && (
        <section aria-label="Yours" className="space-y-2">
          <SectionLabel>You linked these here</SectionLabel>
          <ul className="flex flex-wrap gap-1.5 list-none p-0">
            {yours.map((p, i) => (
              <li key={`${p.href}-${i}`}>
                <Link href={p.href} className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong">
                  {p.name}
                  {p.side === "shadow" && <span className="text-ink-ghost"> · hard side</span>}
                  {p.side === "light" && <span className="text-ink-ghost"> · good side</span>}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-ghost">Only you can see these. They are kept apart from the app&rsquo;s own matches.</p>
        </section>
      )}

      <section aria-label="Other tools" className="space-y-3">
        <SectionLabel>In other tools</SectionLabel>
        {symbols.length === 0 && <p className="text-sm text-ink-faint">No symbol in the other tools is matched to this archetype yet.</p>}
        {[...byTool.entries()].map(([tool, items]) => (
          <div key={tool} className="space-y-1.5">
            <p className="text-xs text-ink-faint">{tool}</p>
            <ul className="flex flex-wrap gap-1.5 list-none p-0">
              {items.map((s) => (
                <li key={s.href + s.name}>
                  <Link
                    href={s.href}
                    title={[s.keywords, s.basis ? `Drawn from: ${BASIS_LABELS[s.basis] ?? s.basis}` : ""].filter(Boolean).join(". ")}
                    className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft hover:border-line-hover hover:text-ink-strong"
                  >
                    {s.name}
                    {s.aspect === "shadow" && <span className="text-ink-ghost"> · hard side</span>}
                    {s.basis && <span className="text-ink-ghost"> · {BASIS_LABELS[s.basis] ?? s.basis}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {basesShown.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-ink-faint">What the small labels mean (age is information, not rank; authors differ):</p>
            <ul className="list-none p-0 space-y-0.5">
              {basesShown.map((b) => (
                <li key={b} className="text-[11px] text-ink-faint">
                  <span className="text-ink-soft">{BASIS_LABELS[b]}:</span> {BASES[b]}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: getArchetype(slug)?.name ?? "Archetype" };
}
