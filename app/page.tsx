import Link from "next/link";
import { redirect } from "next/navigation";
import { privacyAcknowledged } from "@/lib/privacy";
import { Tile } from "@/components/ui/Tile";
import NavGlyph, { hasNavGlyph } from "@/components/ui/NavGlyph";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDate } from "@/lib/date";
import HomeTools from "@/components/HomeTools";
import ToolSummaryCard from "@/components/ToolSummaryCard";
import { loadToolSummaries } from "@/lib/tool-summary";
import WorldMap from "@/components/world/WorldMap";
import CompanionFocusCard from "@/components/CompanionFocusCard";
import TourCard from "@/components/TourCard";
import { tourSeen } from "@/lib/tour";
import SkyLine from "@/components/SkyLine";
import ToolFilterLine from "@/components/ToolFilterLine";
import { getPrefs } from "@/lib/prefs";
import { NAV_GROUPS, itemShown } from "@/lib/nav-groups";
import { shapeOf } from "@/lib/edition";
import {
  DIVINATION_KIND_LABELS,
  divinationPath,
  isWidened,
  type DivinationKind,
} from "@/lib/divinations";
import { toolsLeftOut } from "@/lib/divination-kinds";
import { loadHomeThemes } from "@/lib/patterns";
import AppSigil from "@/components/ui/AppSigil";
import { HomeTake } from "@/components/DivinationTakes";
import { hiddenTakeIds, keptTakeIds, listOwnTakes } from "@/lib/divination-takes";

/** One line in "Recent Readings": a tarot reading or a reading made with another tool. */
interface RecentReading {
  kind: DivinationKind;
  href: string;
  title: string;
  question: string | null;
  /** The small line under the title: the tool, and for tarot the spread. */
  detail: string;
  created_at: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string; tour?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  // The page starts with the tools the person chose. "Show everything" widens this one page; the saved choice stays.
  const prefs = await getPrefs(session.userId!);
  // Anyone who has not read the current privacy and terms text sees the one-time "Before you start" screen first.
  if (!(await privacyAcknowledged(session.userId!))) redirect("/welcome");
  // The first-run tour shows once; "?tour=1" (from the How this works page) shows it again without changing that.
  const replayTour = sp.tour === "1";
  const showTour = replayTour || !(await tourSeen(session.userId!));
  const widened = isWidened(sp);
  const shown = widened ? null : prefs.tools;
  const shows = (kind: DivinationKind) => shown === null || shown.includes(kind);
  const showsTarot = shows("tarot");

  // Tarot readings are counted and listed from `readings`; readings made with any other tool from their shared record.
  // The card patterns are made from tarot readings, so they are read only when Tarot is shown.
  const [readingCountRow, layoutCountRow, recentTarot, recentOther, journalCountRow] =
    await Promise.all([
      queryOne<{ c: string }>(
        `SELECT (SELECT COUNT(*) FROM readings WHERE user_id = $1 AND $3::boolean)
              + (SELECT COUNT(*) FROM divinations
                 WHERE user_id = $1 AND kind <> 'tarot' AND ($2::text[] IS NULL OR kind = ANY($2::text[]))) AS c`,
        [session.userId, shown, showsTarot]
      ),
      queryOne<{ c: string }>("SELECT COUNT(*) as c FROM layouts WHERE user_id = $1", [session.userId]),
      showsTarot
        ? (query("SELECT * FROM readings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3", [session.userId]) as Promise<any[]>)
        : Promise.resolve([] as any[]),
      query<{ id: number; kind: DivinationKind; question: string | null; summary: string; created_at: string }>(
        `SELECT id, kind, question, summary, created_at FROM divinations
         WHERE user_id = $1 AND kind <> 'tarot' AND ($2::text[] IS NULL OR kind = ANY($2::text[]))
         ORDER BY created_at DESC, id DESC LIMIT 3`,
        [session.userId, shown]
      ),
      // Entries about tarot readings (reading_id) and about readings of any other kind (divination_id), as on the Journals page.
      queryOne<{ c: string }>(
        `SELECT COUNT(*) AS c FROM journals j
         LEFT JOIN readings r ON r.id = j.reading_id
         LEFT JOIN divinations d ON d.id = j.divination_id
         WHERE COALESCE(r.user_id, d.user_id) = $1
           AND ($2::text[] IS NULL OR COALESCE(d.kind, 'tarot') = ANY($2::text[]))`,
        [session.userId, shown]
      ),
    ]);

  // The themes (archetypes) that came up most in the tools being shown, shared ones and the person's own, counted apart.
  const homeThemes = await loadHomeThemes(session.userId!, shown);
  // A summary for every tool shown that has been used, in the same shape for each: how what came up is spread over its groups, and what keeps coming up.
  const toolSummaries = await loadToolSummaries(session.userId!, shown);

  // Predictions whose date has come and readings to look back on are on today's page now (components/Nudges.tsx).
  // The companion's focus invitation counts every reading of every tool, whatever tools are shown (it is only fetched when the companion is on).
  const allReadings = prefs.companionEnabled
    ? Number((await queryOne<{ c: string }>("SELECT COUNT(*) AS c FROM divinations WHERE user_id = $1", [session.userId]))?.c ?? 0)
    : 0;

  const recentReadings: RecentReading[] = [
    ...recentTarot.map((r) => ({
      kind: "tarot" as const,
      href: divinationPath("tarot", 0, r.id),
      title: r.title || r.spread_name,
      question: r.question,
      detail: `${DIVINATION_KIND_LABELS.tarot} · ${r.spread_name}`,
      created_at: r.created_at,
    })),
    ...recentOther.map((d) => ({
      kind: d.kind,
      href: divinationPath(d.kind, d.id),
      title: d.summary || DIVINATION_KIND_LABELS[d.kind] || "Reading",
      question: d.question,
      detail: DIVINATION_KIND_LABELS[d.kind] ?? "Reading",
      created_at: d.created_at,
    })),
  ]
    .sort((a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime())
    .slice(0, 3);

  // The numbers sit on their tiles. Layouts are shared by every tool that draws several things.
  const counts: Record<string, number> = {
    readings: Number(readingCountRow?.c ?? 0),
    journals: Number(journalCountRow?.c ?? 0),
    layouts: Number(layoutCountRow?.c ?? 0),
  };
  // Every tool, tarot included, gets one tile that opens its page, with its star (components/HomeTools.tsx).
  // The other tiles are the side navigation's groups, so the home page and the navigation use the same names, order and pictures.
  // A copy on one person's computer has no forum or circle, so it has no tiles for them.
  // A leader's copy that serves a circle (host mode) has them, except the feedback link.
  const shape = shapeOf();
  const group = (id: string) => {
    const g = NAV_GROUPS.find((x) => x.id === id)!;
    return { ...g, items: g.items.filter((i) => itemShown(i, true, shape)) };
  };
  const tileGroups = [group("writing"), group("people"), group("learn")].filter((g) => g.items.length > 0);
  // A fresh copy on one person's own computer (release plan §6 idea 9): three ways to begin, until the first reading is made.
  const firstRun =
    (shape === "local" || shape === "feathered") &&
    Number((await queryOne<{ c: string }>("SELECT (SELECT COUNT(*) FROM divinations WHERE user_id = $1) + (SELECT COUNT(*) FROM readings WHERE user_id = $1) AS c", [session.userId]))?.c ?? 0) === 0;
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="text-center space-y-3">
        <AppSigil className="h-24 w-24 mx-auto text-heading" />
        <h1 className="text-4xl font-bold text-heading tracking-wide">Divination Station</h1>
        {/* A take on divination, a different one each visit, which the person can keep; their own takes come round too (lib/divination-takes-core.ts). */}
        <HomeTake seed={Math.floor(Math.random() * 2147483646)} kept={await keptTakeIds(session.userId!)} hidden={await hiddenTakeIds(session.userId!)} own={await listOwnTakes(session.userId!)} />
        <SkyLine className="justify-center" />
      </div>

      {showTour && <TourCard replay={replayTour} />}

      {firstRun && (
        <section aria-labelledby="home-start" className="bg-surface border border-line rounded-card p-5 space-y-3">
          <h2 id="home-start" className="font-semibold text-ink-strong">Where would you like to start?</h2>
          <ul className="grid gap-3 sm:grid-cols-3 list-none p-0">
            <li>
              <Link href="/readings/new" className="block h-full rounded-xl border border-line hover:border-line-hover p-4 space-y-1">
                <span className="block text-sm font-medium text-ink-strong">Try a reading</span>
                <span className="block text-xs text-ink-muted">Draw tarot cards, or open any tool below.</span>
              </Link>
            </li>
            <li>
              <Link href="/oracle" className="block h-full rounded-xl border border-line hover:border-line-hover p-4 space-y-1">
                <span className="block text-sm font-medium text-ink-strong">Make my own cards</span>
                <span className="block text-xs text-ink-muted">Start an oracle deck from your own life.</span>
              </Link>
            </li>
            <li>
              <Link href="/settings#bring-in" className="block h-full rounded-xl border border-line hover:border-line-hover p-4 space-y-1">
                <span className="block text-sm font-medium text-ink-strong">Bring my data from a backup</span>
                <span className="block text-xs text-ink-muted">Bring in the file you saved from another copy.</span>
              </Link>
            </li>
          </ul>
        </section>
      )}

      {/* Plain blocks with headings, not named regions: the side navigation already has regions with these names. */}
      <div className="space-y-3">
        <h2 id="home-tools" className="text-sm text-ink-faint uppercase tracking-widest">{group("tools").label}</h2>
        <ToolFilterLine tools={prefs.tools} widened={widened} path="/" hidden={toolsLeftOut(prefs.tools)} noun="tools" />
        <HomeTools tools={prefs.tools} widened={widened} />
      </div>

      {tileGroups.map((g) => (
        <div key={g.id} className="space-y-3">
          <h2 id={`home-${g.id}`} className="text-sm text-ink-faint uppercase tracking-widest">{g.label}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {g.items.map((item) => (
              <Tile key={item.id} href={item.href!} icon={hasNavGlyph(item.id) ? <NavGlyph id={item.id} className="inline-block h-8 w-8" /> : item.icon} label={item.label} note={item.note} count={counts[item.id]} />
            ))}
          </div>
        </div>
      ))}

      <CompanionFocusCard readingCount={allReadings} />

      {(toolSummaries.length > 0 || homeThemes.shared.length > 0 || homeThemes.own.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-ink-faint uppercase tracking-widest">Your Patterns</h2>
            <Link href="/insights" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">
              Full insights →
            </Link>
          </div>
          {toolSummaries.length > 0 && (
            <div className="space-y-3">
              {toolSummaries.map((t) => (
                <ToolSummaryCard key={t.kind} summary={t} />
              ))}
            </div>
          )}

          {(homeThemes.shared.length > 0 || homeThemes.own.length > 0) && (
            <div className="bg-surface border border-line rounded-card p-5 space-y-3 mt-3">
              {homeThemes.shared.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-ink-ghost uppercase tracking-widest">Themes that come up most</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 list-none p-0 text-sm text-ink-soft">
                    {homeThemes.shared.map((t) => (
                      <li key={t.slug}>
                        <Link href={`/archetypes/${t.slug}`} className="underline hover:text-ink-strong">{t.name}</Link>
                        <span className="text-xs text-tone-500"> ×{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {homeThemes.own.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-ink-ghost uppercase tracking-widest">Your own, counted apart</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 list-none p-0 text-sm text-ink-soft">
                    {homeThemes.own.map((t) => (
                      <li key={t.key}>
                        {t.name}
                        <span className="text-xs text-ink-faint"> ({t.kind === "your archetype" ? "yours" : "your concept"})</span>
                        <span className="text-xs text-tone-500"> ×{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {recentReadings.length > 0 && (
        <div>
          <h2 className="text-sm text-ink-faint uppercase tracking-widest mb-4">Recent Readings</h2>
          <div className="space-y-3">
            {recentReadings.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="block bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
              >
                <div className="flex flex-wrap justify-between items-start gap-y-1">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-strong">{r.title}</p>
                    {r.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{r.question}</p>}
                  </div>
                  <span className="text-xs text-ink-ghost whitespace-nowrap ml-4">
                    {parseDate(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-tone-500 mt-1">{r.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* The world map: a point where each tool began, as far as anyone can tell. The earlier tower map is kept in components/archive. */}
      <section aria-labelledby="wander-map" className="space-y-3">
        <h2 id="wander-map" className="text-sm text-ink-faint uppercase tracking-widest text-center">Wander the map</h2>
        <p className="text-sm text-ink-muted text-center max-w-xl mx-auto">
          Where each tool began, as far as anyone can tell.
        </p>
        <WorldMap />
      </section>

      <footer className="border-t border-line-faint pt-4 text-center space-x-4">
        <Link href="/guide" className="text-xs text-ink-faint hover:text-ink-soft transition-colors">
          How this works
        </Link>
        <Link href="/about" className="text-xs text-ink-faint hover:text-ink-soft transition-colors">
          About
        </Link>
        <Link href="/privacy" className="text-xs text-ink-faint hover:text-ink-soft transition-colors">
          Privacy and terms
        </Link>
      </footer>
    </div>
  );
}
