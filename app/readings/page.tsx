import Link from "next/link";
import { Suspense } from "react";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import TagManager from "@/components/TagManager";
import TagFilter from "@/components/TagFilter";
import ReadingsTabWrapper from "@/components/ReadingsTabWrapper";
import { hiddenIn } from "@/lib/edition-features";
import ToolFilterLine from "@/components/ToolFilterLine";
import NewReadingMenu from "@/components/NewReadingMenu";
import { listPulls, type OraclePull } from "@/lib/oracle";
import { listSessions, surfaceLabel, type ScryingSession } from "@/lib/scrying";
import { listAnswers, type PendulumAnswer } from "@/lib/pendulum";
import { listDraws, type RuneDraw } from "@/lib/runes";
import { listDraws as listOghamDraws, type OghamDraw } from "@/lib/ogham";
import { listThrows, throwLine, type DiceThrow } from "@/lib/dice";
import { DEFAULT_PREFS, getPrefs } from "@/lib/prefs";
import {
  DIVINATION_KIND_LABELS,
  DIVINATION_KINDS,
  countReadingsNotIn,
  isWidened,
  toolFilterHref,
  toolNames,
  type DivinationKind,
} from "@/lib/divinations";
import { cardLiftClass } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Page";
import { divinationPath } from "@/lib/divination-kinds";
import { divinationIdsWithTag, tagsByDivination, type DivinationTag } from "@/lib/divination-tags";

/** The tools that have no list of their own on this page: their readings are listed from the shared record (their one-line summary is what came up). */
const SUMMARY_KINDS: DivinationKind[] = DIVINATION_KINDS.filter((k) => ["iching", "geomancy", "bibliomancy"].includes(k));

/** The tags on a reading of another tool, as small labels under it (they are edited on the reading's own page). */
function chips(tags: DivinationTag[] | undefined) {
  if (!tags || tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 list-none p-0 px-4 pb-3" aria-label="Tags">
      {tags.map((t) => (
        <li key={t.id} className="text-[11px] text-ink-soft border border-line rounded-full px-2 py-0.5">
          {t.name}
        </li>
      ))}
    </ul>
  );
}

export default async function ReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag_id?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const filterTagId = sp.tag_id ? parseInt(sp.tag_id) : null;

  const session = await getSession();

  // The page starts with the tools the person chose. "Show everything" widens this one page; the saved choice stays.
  const prefs = session.userId ? await getPrefs(session.userId) : DEFAULT_PREFS;
  const widened = isWidened(sp);
  const shown = widened ? null : prefs.tools;
  const shows = (kind: DivinationKind) => shown === null || shown.includes(kind);
  const keep = { tag_id: sp.tag_id };
  // Tags on readings with the other tools (migration 083): the tags on each, and the readings that carry the tag chosen in the filter.
  const [otherTags, taggedIds] = session.userId
    ? await Promise.all([tagsByDivination(session.userId), filterTagId ? divinationIdsWithTag(session.userId, filterTagId) : Promise.resolve(null)])
    : [new Map<number, DivinationTag[]>(), null];
  const wanted = (id: number) => taggedIds === null || taggedIds.has(id);

  // Pulls from the person's oracle decks, their scrying sessions, and the pendulum's answers sit in the same list,
  // by date. Only tarot readings have tags, so a tag filter shows tarot only.
  const [userTags, tarotReadings, pulls, sessions, pendulumAnswers, runeDraws, oghamDraws, diceThrows, summaryReadings, hiddenCount] = await Promise.all([
    query("SELECT * FROM tags WHERE user_id = $1 ORDER BY name ASC", [session.userId]),
    (async () => {
      if (!shows("tarot")) return [] as any[];
      const params: any[] = [session.userId];
      let sql = `
        SELECT r.*,
          COALESCE(
            (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
             FROM reading_tags rt JOIN tags t ON t.id = rt.tag_id
             WHERE rt.reading_id = r.id),
            '[]'::json
          ) AS tags
        FROM readings r
        WHERE r.user_id = $1
      `;
      if (filterTagId) {
        sql += ` AND EXISTS (SELECT 1 FROM reading_tags WHERE reading_id = r.id AND tag_id = $2)`;
        params.push(filterTagId);
      }
      sql += " ORDER BY r.created_at DESC";
      return query(sql, params) as Promise<any[]>;
    })(),
    !session.userId || !shows("oracle")
      ? Promise.resolve([] as OraclePull[])
      : listPulls(session.userId),
    !session.userId || !shows("scrying")
      ? Promise.resolve([] as ScryingSession[])
      : listSessions(session.userId),
    !session.userId || !shows("pendulum")
      ? Promise.resolve([] as PendulumAnswer[])
      : listAnswers(session.userId),
    !session.userId || !shows("runes")
      ? Promise.resolve([] as RuneDraw[])
      : listDraws(session.userId),
    !session.userId || !shows("ogham")
      ? Promise.resolve([] as OghamDraw[])
      : listOghamDraws(session.userId),
    !session.userId || !shows("dice")
      ? Promise.resolve([] as DiceThrow[])
      : listThrows(session.userId),
    !session.userId || !SUMMARY_KINDS.some(shows)
      ? Promise.resolve([] as { id: number; kind: DivinationKind; question: string | null; summary: string; created_at: string }[])
      : (query(
          "SELECT id, kind, question, summary, created_at FROM divinations WHERE user_id = $1 AND kind = ANY($2::text[]) ORDER BY created_at DESC",
          [session.userId, SUMMARY_KINDS.filter(shows)]
        ) as Promise<{ id: number; kind: DivinationKind; question: string | null; summary: string; created_at: string }[]>),
    // How many readings the saved choice of tools is leaving out. With a tag chosen, the list is narrowed by the tag too.
    session.userId && !filterTagId && !widened ? countReadingsNotIn(session.userId, prefs.tools) : Promise.resolve(0),
  ]);

  const items = [
    ...tarotReadings.map((r) => ({ type: "tarot" as const, at: parseDate(r.created_at).getTime(), r })),
    ...pulls.filter((p) => wanted(p.id)).map((p) => ({ type: "oracle" as const, at: parseDate(p.created_at).getTime(), p })),
    ...sessions.filter((x) => wanted(x.id)).map((s) => ({ type: "scrying" as const, at: parseDate(s.created_at).getTime(), s })),
    ...pendulumAnswers.filter((x) => wanted(x.id)).map((a) => ({ type: "pendulum" as const, at: parseDate(a.created_at).getTime(), a })),
    ...runeDraws.filter((x) => wanted(x.id)).map((d) => ({ type: "runes" as const, at: parseDate(d.created_at).getTime(), d })),
    ...oghamDraws.filter((x) => wanted(x.id)).map((o) => ({ type: "ogham" as const, at: parseDate(o.created_at).getTime(), o })),
    ...diceThrows.filter((x) => wanted(x.id)).map((t) => ({ type: "dice" as const, at: parseDate(t.created_at).getTime(), t })),
    ...summaryReadings.filter((x) => wanted(x.id)).map((x) => ({ type: "summary" as const, at: parseDate(x.created_at).getTime(), x })),
  ].sort((a, b) => b.at - a.at);

  return (
    <ReadingsTabWrapper forum={!hiddenIn(process.env.DS_EDITION, "/forum")}>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <PageTitle>Readings</PageTitle>
            <div className="flex items-center gap-2">
              <Suspense>
                <TagFilter userTags={userTags as any} selectedTagId={filterTagId} />
              </Suspense>
              <NewReadingMenu tools={prefs.tools} />
            </div>
          </div>
          <ToolFilterLine tools={prefs.tools} widened={widened} path="/readings" keep={keep} hidden={hiddenCount} />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 text-ink-faint">
            <div aria-hidden="true" className="text-5xl mb-4">🃏</div>
            {shown ? (
              <>
                <p>
                  Nothing here for {toolNames(shown)}
                  {filterTagId ? " with this tag." : " yet."}
                </p>
                <Link
                  href={toolFilterHref("/readings", true, keep)}
                  className="text-tone-400 hover:text-tone-300 text-sm mt-2 inline-block"
                >
                  Show everything
                </Link>
              </>
            ) : (
              <>
                <p>{filterTagId ? "No readings with this tag." : "No readings yet."}</p>
                {!filterTagId && (
                  <div className="mt-2 space-y-1">
                    <Link href="/readings/first" className="text-tone-400 hover:text-tone-300 text-sm inline-block">
                      Try a guided first reading →
                    </Link>
                    <p className="text-xs text-ink-ghost">One card and three short questions.</p>
                    <Link href="/readings/new" className="text-tone-400 hover:text-tone-300 text-sm inline-block">
                      Or begin a reading of your own →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-3" aria-label={`${items.length} reading${items.length !== 1 ? "s" : ""}`}>
            {items.map((item) => {
              if (item.type === "oracle") {
                const p = item.p;
                const cardLine = p.cards.map((c) => c.card_name + (c.reversed ? " (upside down)" : "")).join(", ");
                return (
                  <li key={`oracle-${p.id}`} className={cardLiftClass}>
                    <Link href={`/oracle/pulls/${p.id}`} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">{cardLine || "Pull"}</p>
                          {p.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{p.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">
                            {DIVINATION_KIND_LABELS.oracle} · {p.deck_name}
                          </p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(p.created_at)}>{parseDate(p.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(p.id))}
                  </li>
                );
              }
              if (item.type === "summary") {
                const x = item.x;
                return (
                  <li key={`${x.kind}-${x.id}`} className={cardLiftClass}>
                    <Link href={divinationPath(x.kind, x.id)} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">{x.summary || "Reading"}</p>
                          {x.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{x.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">{DIVINATION_KIND_LABELS[x.kind]}</p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(x.created_at)}>{parseDate(x.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(x.id))}
                  </li>
                );
              }
              if (item.type === "dice") {
                const t = item.t;
                return (
                  <li key={`dice-${t.id}`} className={cardLiftClass}>
                    <Link href={`/dice/${t.id}`} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">
                            {throwLine(t.results, 8)}
                          </p>
                          {t.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{t.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">{DIVINATION_KIND_LABELS.dice}</p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(t.created_at)}>{parseDate(t.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(t.id))}
                  </li>
                );
              }
              if (item.type === "ogham") {
                const d = item.o;
                return (
                  <li key={`ogham-${d.id}`} className={cardLiftClass}>
                    <Link href={`/ogham/${d.id}`} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">{d.staves.map((s) => s.stave_name).join(", ")}</p>
                          {d.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{d.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">{DIVINATION_KIND_LABELS.ogham}</p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(d.created_at)}>{parseDate(d.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(d.id))}
                  </li>
                );
              }
              if (item.type === "runes") {
                const d = item.d;
                return (
                  <li key={`runes-${d.id}`} className={cardLiftClass}>
                    <Link href={`/runes/${d.id}`} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">
                            {d.runes.map((r) => r.rune_name + (r.reversed ? " (upside down)" : "")).join(", ")}
                          </p>
                          {d.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{d.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">{DIVINATION_KIND_LABELS.runes}</p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(d.created_at)}>{parseDate(d.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(d.id))}
                  </li>
                );
              }
              if (item.type === "pendulum") {
                const a = item.a;
                return (
                  <li key={`pendulum-${a.id}`} className={cardLiftClass}>
                    <Link href={`/pendulum/${a.id}`} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">{a.swing_name}</p>
                          {a.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{a.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">{DIVINATION_KIND_LABELS.pendulum}</p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(a.created_at)}>{parseDate(a.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(a.id))}
                  </li>
                );
              }
              if (item.type === "scrying") {
                const s = item.s;
                return (
                  <li key={`scrying-${s.id}`} className={cardLiftClass}>
                    <Link href={`/scrying/${s.id}`} className="block p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-strong truncate">{surfaceLabel(s.surface)}</p>
                          {s.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{s.question}</p>}
                          <p className="text-xs text-tone-500 mt-1">{DIVINATION_KIND_LABELS.scrying}</p>
                        </div>
                        <span className="text-xs text-ink-ghost whitespace-nowrap">
                          <time dateTime={toISOString(s.created_at)}>{parseDate(s.created_at).toLocaleDateString()}</time>
                        </span>
                      </div>
                    </Link>
                    {chips(otherTags.get(s.id))}
                  </li>
                );
              }
              const r = item.r;
              const cards = JSON.parse(r.cards);
              const tags = Array.isArray(r.tags) ? r.tags : [];
              return (
                <li key={r.id} className={cardLiftClass}>
                  <Link
                    href={`/readings/${r.id}`}
                    className="block p-4 pb-2"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink-strong truncate">{r.title || r.spread_name}</p>
                        {r.question && <p className="text-sm text-ink-faint mt-0.5 line-clamp-1">{r.question}</p>}
                        <p className="text-xs text-tone-500 mt-1">
                          {DIVINATION_KIND_LABELS.tarot} · {r.spread_name} · {cards.length} cards
                        </p>
                      </div>
                      <span className="text-xs text-ink-ghost whitespace-nowrap">
                        <time dateTime={toISOString(r.created_at)}>{parseDate(r.created_at).toLocaleDateString()}</time>
                      </span>
                    </div>
                  </Link>
                  <div className="px-4 pb-3">
                    <TagManager entityType="reading" entityId={r.id} initialTags={tags} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ReadingsTabWrapper>
  );
}

export const metadata = { title: "Readings" };
