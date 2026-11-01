import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DEFAULT_PREFS, getPrefs } from "@/lib/prefs";
import { listDecks } from "@/lib/oracle";
import { countOf } from "@/lib/oracle-forms";
import {
  DIVINATION_KIND_LABELS,
  DIVINATION_KINDS,
  isWidened,
  toolsLeftOut,
  type DivinationKind,
} from "@/lib/divination-kinds";
import ToolFilterLine from "@/components/ToolFilterLine";
import TarotLibrary from "@/components/library/TarotLibrary";
import { BackLink, JumpLinks, PageTitle, SectionLabel, type JumpItem } from "@/components/ui/Page";
import { CardLink } from "@/components/ui/Card";
import ToolGlyph from "@/components/ui/ToolGlyph";

interface SetCard {
  href: string;
  name: string;
  note: string;
}

/** The working sets of the tools other than tarot, which has its own library below. */
async function setsOf(kind: DivinationKind, userId: number): Promise<SetCard[]> {
  switch (kind) {
    case "oracle": {
      const decks = await listDecks(userId);
      if (decks.length === 0) return [{ href: "/oracle", name: "Your first deck", note: "Make a card to start it" }];
      return decks.map((d) => ({
        href: `/oracle?deck=${d.id}`,
        name: d.name,
        note: `${countOf(d.form, d.card_count)}${d.description ? ` · ${d.description}` : ""}`,
      }));
    }
    case "runes":
      return [{ href: "/runes/set", name: "Elder Futhark", note: "The 24 runes, with your own words on each" }];
    case "ogham":
      return [{ href: "/ogham/set", name: "Ogham staves", note: "20 staves in four groups, and 5 later letters" }];
    case "dice":
      return [{ href: "/dice/set", name: "Dice and coins", note: "What each face means to you" }];
    case "pendulum":
      return [{ href: "/pendulum/swings", name: "Pendulum swings", note: "Which swings are in play, and what each means to you" }];
    case "scrying":
      return [{ href: "/scrying", name: "Scrying surfaces", note: "Dark mirror, crystal ball, bowl of water" }];
    case "iching":
      return [{ href: "/iching/set", name: "The 64 hexagrams", note: "With your own words on each" }];
    case "geomancy":
      return [{ href: "/geomancy/set", name: "The 16 figures", note: "With your own words on each" }];
    case "bibliomancy":
      return [{ href: "/bibliomancy", name: "Pulls from your writing", note: "Words and sentences found at random in what you wrote" }];
    default:
      return [];
  }
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // The page starts with the tools the person chose. "Show everything" widens this one page; the saved choice stays.
  const prefs = session.userId ? await getPrefs(session.userId) : DEFAULT_PREFS;
  const widened = isWidened(sp);
  const shown = widened ? null : prefs.tools;
  const shows = (kind: DivinationKind) => shown === null || shown.includes(kind);

  const others = DIVINATION_KINDS.filter((k) => k !== "tarot" && shows(k));
  const sets = await Promise.all(others.map(async (k) => ({ kind: k, cards: await setsOf(k, session.userId!) })));

  const jumps: JumpItem[] = [
    ...sets.map(({ kind }) => ({ id: `lib-${kind}`, label: DIVINATION_KIND_LABELS[kind] })),
    { id: "lib-archetypes", label: "Archetypes" },
    ...(shows("oracle") ? [{ id: "lib-gallery", label: "Gallery" }] : []),
    { id: "lib-layouts", label: "Layouts" },
    { id: "lib-predictions", label: "Predictions" },
    ...(shows("tarot") ? [{ id: "tarot-library", label: "Tarot" }] : []),
  ];

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        <div className="space-y-1">
          <BackLink href="/">← Home</BackLink>
          <PageTitle>The Library</PageTitle>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          The sets you read with: your decks, runes, staves, dice and the rest, and the tarot library. Choose which
          tools appear here with the stars on the tool tiles of the <Link href="/" className="text-accent-ink hover:text-accent-ink-hover underline">home page</Link>.
        </p>
        <ToolFilterLine tools={prefs.tools} widened={widened} path="/library" hidden={toolsLeftOut(prefs.tools)} noun="tools" />
        <JumpLinks items={jumps} />

        {sets.map(({ kind, cards }) => (
          <section key={kind} id={`lib-${kind}`} aria-label={DIVINATION_KIND_LABELS[kind]} className="space-y-3">
            <SectionLabel>
              <ToolGlyph kind={kind} className="inline-block h-[1.1em] w-[1.1em] align-text-bottom" /> {DIVINATION_KIND_LABELS[kind]}
            </SectionLabel>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
              {cards.map((c) => (
                <li key={c.href}>
                  <CardLink href={c.href} lift className="h-full">
                    <p className="font-medium text-ink-strong break-words">{c.name}</p>
                    <p className="text-xs text-ink-faint mt-1 line-clamp-2 break-words">{c.note}</p>
                  </CardLink>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section id="lib-archetypes" aria-label="Archetypes" className="space-y-3">
          <SectionLabel>🌐 Archetypes</SectionLabel>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            <li>
              <CardLink href="/archetypes" lift className="h-full">
                <p className="font-medium text-ink-strong">Shared archetypes</p>
                <p className="text-xs text-ink-faint mt-1">What tarot, runes, ogham, dice, the I Ching, geomancy, and the rest have in common</p>
              </CardLink>
            </li>
          </ul>
        </section>

        {shows("oracle") && (
          <section id="lib-gallery" aria-label="Gallery" className="space-y-3">
            <SectionLabel>🖼️ Gallery</SectionLabel>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
              <li>
                <CardLink href="/oracle/gallery" lift className="h-full">
                  <p className="font-medium text-ink-strong">Your gallery</p>
                  <p className="text-xs text-ink-faint mt-1">Pictures you keep, ready to put on any item</p>
                </CardLink>
              </li>
            </ul>
          </section>
        )}

        <section id="lib-layouts" aria-label="Layouts" className="space-y-3">
          <SectionLabel>📐 Layouts</SectionLabel>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            <li>
              <CardLink href="/layouts" lift className="h-full">
                <p className="font-medium text-ink-strong">Your layouts</p>
                <p className="text-xs text-ink-faint mt-1">Named positions, colours, and boards, for every tool</p>
              </CardLink>
            </li>
          </ul>
        </section>
        <section id="lib-predictions" aria-label="Predictions" className="space-y-3">
          <SectionLabel>🔭 Predictions</SectionLabel>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            <li>
              <CardLink href="/predictions" lift className="h-full">
                <p className="font-medium text-ink-strong">Your predictions</p>
                <p className="text-xs text-ink-faint mt-1">What you expected after a reading, and what happened</p>
              </CardLink>
            </li>
          </ul>
        </section>
      </div>

      {shows("tarot") && <TarotLibrary />}
    </div>
  );
}

export const metadata = { title: "Tarot library" };
