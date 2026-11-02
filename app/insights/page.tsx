"use client";

import { useAiReady } from "@/components/AiReady";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { TAROT_DECK } from "@/lib/cards";
import { parseDate } from "@/lib/date";
import { DIVINATION_KIND_LABELS, SHOW_ALL_PARAM, toolFilterHref, toolNames, type DivinationKind } from "@/lib/divination-kinds";
import { useChosenTools } from "@/components/ChosenTools";
import ToolFilterLine from "@/components/ToolFilterLine";
import AcrossTools from "@/components/AcrossTools";
import ToolSummaryCard from "@/components/ToolSummaryCard";
import type { ToolSummary } from "@/lib/tool-summary-core";
import ClothCountsInPatterns from "@/components/cloth/ClothCountsInPatterns";
import type { ClothCountRow } from "@/lib/cloth-core";
import SuitRing from "@/components/SuitRing";
import { SUIT_META, type SuitDist } from "@/lib/suit-meta";
import { MOON_SYMBOL } from "@/lib/sky";
import { BackLink } from "@/components/ui/Page";
import { styleRef } from "@/lib/apply-style";
import { SigilMark } from "@/components/ui/AppSigil";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PositionBreakdown {
  position_name: string;
  spread_name: string;
  count: number;
  reversed_count: number;
}

interface ReadingOccurrence {
  reading_id: number;
  position_name: string;
  reversed: boolean;
  created_at: string;
  question: string | null;
  title: string | null;
  spread_name: string;
}

interface RecurringCard {
  card_id: string;
  card_name: string;
  total: number;
  reversed_count: number;
  upright_count: number;
  first_drawn: string;
  last_drawn: string;
  positions: PositionBreakdown[];
  readings: ReadingOccurrence[];
}

interface ClarifiedCard {
  card_id: string;
  position_name: string;
  clarifier_count: number;
}

interface TopCard {
  card_id: string;
  card_name: string;
  total: number;
}

interface InsightsData {
  totals: {
    total_draws: number;
    spread_draws: number;
    clarifier_draws: number;
    total_reversed: number;
    total_readings: number;
  };
  suitDistribution: SuitDist[];
  recurringCards: RecurringCard[];
  mostClarified: ClarifiedCard[];
  cardCounts: Record<string, number>;
  topMajor: TopCard | null;
  topMinor: TopCard | null;
  sky?: { byMoonPhase: SkyGroup[]; byDay: SkyGroup[] };
  archetypes?: ArchetypeTally[];
  /** The person's own archetypes and concepts that came up, counted apart from the shared ones. */
  own?: OwnTally[];
  /** A summary for each tool other than tarot that has been used, shaped like tarot's suit chart. */
  toolSummaries?: ToolSummary[];
  /** Where items landed on the person's cloths, grouped by cloth, tool and zone. */
  clothCounts?: ClothCountRow[];
  /** Readings in tools the saved choice leaves out. */
  hiddenReadings?: number;
}

interface SideCounts { light: number; shadow: number; either: number }
interface OwnTally {
  key: string;
  name: string;
  kind: "your archetype" | "your concept" | "shared archetype you linked";
  slug: string | null;
  byTool: Partial<Record<DivinationKind, number>>;
  total: number;
}
interface ArchetypeTally {
  slug: string;
  name: string;
  byTool: Partial<Record<DivinationKind, SideCounts>>;
}

interface SkyGroup {
  key: string;
  readings: number;
  topCards: { name: string; count: number }[];
}

function SkyGroupList({ title, groups, symbols }: { title: string; groups: SkyGroup[]; symbols?: Record<string, string> }) {
  return (
    <div className="bg-surface border border-line rounded-card p-4">
      <h3 className="text-[10px] text-ink-faint uppercase tracking-widest mb-3">{title}</h3>
      <ul className="space-y-2.5">
        {groups.map((g) => (
          <li key={g.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-strong">
                {symbols?.[g.key] && <span aria-hidden="true" className="mr-1.5">{symbols[g.key]}</span>}
                {g.key}
              </span>
              <span className="text-xs text-tone-500 flex-shrink-0">
                {g.readings} reading{g.readings !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[11px] text-ink-faint mt-0.5">
              {g.topCards.map((c) => `${c.name}${c.count > 1 ? ` ×${c.count}` : ""}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function cardFileName(card_id: string) {
  return TAROT_DECK.find((c) => c.id === card_id)?.fileName ?? null;
}

// ─── Suit legend row ──────────────────────────────────────────────────────────
function SuitLegend({ distribution }: { distribution: SuitDist[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  const ordered = ["major", "cups", "wands", "swords", "pentacles"];
  const sorted = ordered
    .map((s) => distribution.find((d) => d.suit === s))
    .filter(Boolean) as SuitDist[];

  return (
    <div className="space-y-2">
      {sorted.map((d) => {
        const meta = SUIT_META[d.suit] ?? { label: d.suit, color: "#6b7280" };
        const share = pct(d.count, total);
        return (
          <div key={d.suit} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              ref={styleRef({ background: meta.color })}
              aria-hidden="true"
            />
            <span className="text-xs text-ink-muted w-28 flex-shrink-0">{meta.label}</span>
            <div
              className="h-1.5 rounded-full flex-1 bg-line overflow-hidden"
              role="progressbar"
              aria-valuenow={share}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${meta.label}: ${share}%`}
            >
              <div
                className="h-full rounded-full transition-all duration-500 w-0"
                ref={styleRef({ width: `${share}%`, background: meta.color })}
              />
            </div>
            <span className="text-xs text-ink-faint w-8 text-right">{share}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recurring card row ───────────────────────────────────────────────────────
function RecurringCardRow({ card }: { card: RecurringCard }) {
  const [open, setOpen] = useState(false);
  const fileName = cardFileName(card.card_id);
  const reversalPct = pct(card.reversed_count, card.total);

  return (
    <div className="bg-surface border border-line rounded-card overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-tone-900/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tone-500"
      >
        {/* Mini card image */}
        <div
          className="flex-shrink-0 overflow-hidden rounded border border-line-strong w-[42px] h-[74px]"
          aria-hidden="true"
        >
          {fileName ? (
            <img
              src={`/cards/${fileName}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-canvas flex items-center justify-center text-tone-700 text-sm">
              <SigilMark />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-ink-strong text-sm">{card.card_name}</span>
            <span className="text-xs text-tone-400 font-semibold">×{card.total}</span>
          </div>

          {/* Position pills */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {card.positions.slice(0, 4).map((p, i) => (
              <span
                key={i}
                className="text-[9px] bg-tone-900/30 text-tone-400 rounded px-1.5 py-0.5 uppercase tracking-wide"
              >
                {p.position_name}{p.count > 1 ? ` ×${p.count}` : ""}
              </span>
            ))}
            {card.positions.length > 4 && (
              <span className="text-[9px] text-ink-ghost">+{card.positions.length - 4} more</span>
            )}
          </div>

          {/* Reversal bar */}
          <div className="flex items-center gap-2 mt-2">
            <div
              className="h-1 rounded-full bg-line overflow-hidden flex-1 max-w-[120px]"
              role="progressbar"
              aria-label={`${reversalPct}% reversed`}
              aria-valuenow={reversalPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-danger/70 transition-all w-0"
                ref={styleRef({ width: `${reversalPct}%` })}
              />
            </div>
            {reversalPct > 0 ? (
              <span className="text-[9px] text-ink-ghost">
                {reversalPct}% reversed
              </span>
            ) : (
              <span className="text-[9px] text-ink-ghost">always upright</span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <span className="text-ink-ghost text-xs flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded timeline */}
      {open && (
        <div className="border-t border-line-faint px-4 py-4 space-y-4">
          {/* Position breakdown */}
          {card.positions.length > 0 && (
            <div>
              <p className="text-[10px] text-tone-600 uppercase tracking-widest mb-2">
                Position breakdown
              </p>
              <div className="space-y-1">
                {card.positions.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">
                      {p.position_name}
                      <span className="text-ink-ghost ml-1 text-[10px]">({p.spread_name})</span>
                    </span>
                    <span className="text-tone-500 font-medium">×{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reading timeline */}
          <div>
            <p className="text-[10px] text-tone-600 uppercase tracking-widest mb-2">
              Reading timeline
            </p>
            <ol className="space-y-2" aria-label={`All readings featuring ${card.card_name}`}>
              {card.readings.map((r, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span
                    className="text-[9px] text-ink-ghost mt-0.5 flex-shrink-0 w-[72px]"
                    aria-label={parseDate(r.created_at).toLocaleDateString()}
                  >
                    {parseDate(r.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/readings/${r.reading_id}`}
                      className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors"
                    >
                      {r.title || r.spread_name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-ink-ghost bg-tone-900/20 rounded px-1.5 py-0.5">
                        {r.position_name}
                      </span>
                      {r.reversed ? (
                        <span className="text-[9px] text-danger">Reversed</span>
                      ) : (<span className="text-[9px]">Upright</span>)}
                    </div>
                    {r.question && (
                      <p className="text-[10px] text-ink-ghost mt-0.5 italic line-clamp-1">
                        &ldquo;{r.question}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hiero pattern reading ────────────────────────────────────────────────────
function HieroPatternReading() {
  const [response, setResponse] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (fetching) return;
    setResponse("");
    setSaved(false);
    setError("");
    setFetching(true);
    let accumulated = "";
    try {
      const res = await fetch("/api/insights/pattern", { method: "POST" });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong" }));
        setError(err.error ?? "Something went wrong");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setResponse(accumulated);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setFetching(false);
    }
  }

  async function saveToJournal() {
    if (!response || saved) return;
    await fetch("/api/synthesis-journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Pattern reading across all readings",
        content: response,
        context_ids: {},
      }),
    });
    setSaved(true);
  }

  return (
    <section
      aria-label="Hiero's pattern reading"
      className="bg-surface-sunken border border-tone-900/30 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-tone-400/80 uppercase tracking-widest"><SigilMark /> Hiero&rsquo;s Pattern Reading</p>
        {response && !fetching && (
          <div className="flex items-center gap-3">
            {!saved && (
              <button
                onClick={saveToJournal}
                className="text-xs text-tone-400 hover:text-tone-300 transition-colors"
              >
                Save to journal
              </button>
            )}
            {saved && <span role="status" className="text-xs text-success">Saved ✓</span>}
            <button
              onClick={() => { setResponse(""); setSaved(false); }}
              className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-ghost leading-relaxed">
        Hiero will read the patterns across your entire history — recurring cards, elemental balance,
        the questions that keep returning. Readings with your other tools are included, from your own words and the names of what came up.
      </p>

      {error && <p role="alert" className="text-xs text-danger">{error}</p>}

      {!response && (
        <button
          onClick={generate}
          disabled={fetching}
          className="w-full text-xs bg-tone-900/30 hover:bg-tone-800/30 disabled:opacity-50 text-tone-300 font-medium py-2.5 px-3 rounded-lg transition-colors border border-tone-800/30"
        >
          {fetching ? "Listening to the whole story…" : "Read the patterns"}
        </button>
      )}

      {fetching && !response && (
        <p className="text-xs text-tone-400/60 animate-pulse text-center">
          Hiero is present…
        </p>
      )}

      {response && (
        <div className="space-y-3">
          <div className="text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-strong:text-tone-300 prose-em:text-tone-200 prose-headings:text-tone-300">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
          {!fetching && (
            <button
              onClick={generate}
              className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors"
            >
              Read again
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Archetypes in your readings ──────────────────────────────────────────────────
/** The archetypes that came up most in the tools being shown, with where each came from. Archetypes are shared by every tool. */
function SharedArchetypesInReadings({ archetypes, shown }: { archetypes: ArchetypeTally[]; shown: DivinationKind[] | null }) {
  const rows = archetypes
    .map((t) => {
      const kinds = (Object.keys(t.byTool) as DivinationKind[]).filter((k) => shown === null || shown.includes(k));
      const sides = kinds.reduce(
        (a, k) => ({
          light: a.light + (t.byTool[k]?.light ?? 0),
          shadow: a.shadow + (t.byTool[k]?.shadow ?? 0),
          either: a.either + (t.byTool[k]?.either ?? 0),
        }),
        { light: 0, shadow: 0, either: 0 }
      );
      return { ...t, kinds, sides, total: sides.light + sides.shadow + sides.either };
    })
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  if (rows.length === 0) return null;
  const max = rows[0].total;
  return (
    <section aria-label="Archetypes in your readings">
      <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-1">Archetypes In Your Readings</h2>
      <p className="text-xs text-ink-ghost mb-3">
        Every tool is matched to the same shared archetypes, so tarot, runes, and the rest add up together. A count is how
        many times a card or symbol touching the archetype came up. It says what keeps appearing, not what it means for
        you. <Link href="/archetypes" className="underline hover:text-ink-soft">All archetypes</Link>
      </p>
      <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
        {rows.map((t) => (
          <li key={t.slug} className="px-4 py-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/archetypes/${t.slug}`} className="text-sm text-ink-soft hover:text-ink-strong max-sm:inline-flex max-sm:items-center max-sm:min-h-11">{t.name}</Link>
              <span className="text-xs text-tone-500 flex-shrink-0">{t.total}×</span>
            </div>
            <div className="h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
              <div className="h-full bg-tone-500 w-0" ref={styleRef({ width: `${Math.max(6, (t.total / max) * 100)}%` })} />
            </div>
            <p className="text-[11px] text-ink-ghost">
              {t.kinds.map((k) => {
                const c = t.byTool[k]!;
                return `${DIVINATION_KIND_LABELS[k]} ${c.light + c.shadow + c.either}`;
              }).join(" · ")}
              {t.sides.light + t.sides.shadow > 0 &&
                ` — on the side that goes well ${t.sides.light}, on the hard side ${t.sides.shadow}${t.sides.either > 0 ? `, both or neither ${t.sides.either}` : ""}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Yours in your readings ───────────────────────────────────────────────────────
/** The tools of an own tally that are being shown, and how many times its pieces came up in them. */
function ownShownOf(own: OwnTally[], shown: DivinationKind[] | null) {
  return own
    .map((t) => {
      const kinds = (Object.keys(t.byTool) as DivinationKind[]).filter((k) => shown === null || shown.includes(k));
      return { ...t, kinds, shownTotal: kinds.reduce((n, k) => n + (t.byTool[k] ?? 0), 0) };
    })
    .filter((t) => t.shownTotal > 0)
    .sort((a, b) => b.shownTotal - a.shownTotal || a.name.localeCompare(b.name));
}

/** The person's own archetypes and concepts that came up, counted by the pieces they linked to them. Never added to the shared counts. */
function YoursInReadings({ own, shown }: { own: OwnTally[]; shown: DivinationKind[] | null }) {
  const rows = ownShownOf(own, shown).slice(0, 12);
  if (rows.length === 0) return null;
  const max = rows[0].shownTotal;
  return (
    <section aria-label="Yours in your readings">
      <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-1">Yours In Your Readings</h2>
      <p className="text-xs text-ink-ghost mb-3">
        These are your own archetypes and concepts, counted by the cards and symbols you linked to them. They are kept apart from
        the shared counts above and never added to them. It says what keeps appearing, not what it means for you.{" "}
        <Link href="/archetypes" className="underline hover:text-ink-soft">Yours</Link>
      </p>
      <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
        {rows.map((t) => (
          <li key={t.key} className="px-4 py-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              {t.slug ? (
                <Link href={`/archetypes/${t.slug}`} className="text-sm text-ink-soft hover:text-ink-strong max-sm:inline-flex max-sm:items-center max-sm:min-h-11">{t.name}</Link>
              ) : (
                <span className="text-sm text-ink-soft">{t.name}</span>
              )}
              <span className="text-xs text-tone-500 flex-shrink-0">{t.shownTotal}×</span>
            </div>
            <div className="h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
              <div className="h-full bg-tone-500 w-0" ref={styleRef({ width: `${Math.max(6, (t.shownTotal / max) * 100)}%` })} />
            </div>
            <p className="text-[11px] text-ink-ghost">
              {t.kind === "shared archetype you linked" ? "A shared archetype you linked pieces to yourself" : t.kind === "your archetype" ? "Your archetype" : "Your concept"}
              {" — "}
              {t.kinds.map((k) => `${DIVINATION_KIND_LABELS[k]} ${t.byTool[k]}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The shared archetypes that came up, and then the person's own, each counted on its own. */
function ArchetypesInReadings({ archetypes, own, shown }: { archetypes: ArchetypeTally[]; own: OwnTally[]; shown: DivinationKind[] | null }) {
  return (
    <>
      <SharedArchetypesInReadings archetypes={archetypes} shown={shown} />
      <YoursInReadings own={own} shown={shown} />
    </>
  );
}

// ─── The other tools ──────────────────────────────────────────────────────────────
function OtherToolSummaries({ summaries, shown }: { summaries: ToolSummary[]; shown: DivinationKind[] | null }) {
  const list = summaries.filter((s) => shown === null || shown.includes(s.kind));
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="other-tool-summaries" className="space-y-3">
      <h2 id="other-tool-summaries" className="text-xs text-ink-faint uppercase tracking-widest">Your other tools</h2>
      <p className="text-xs text-ink-ghost">The same kind of summary tarot has: how what came up is spread over each tool&rsquo;s groups, and what keeps coming up. Counts only.</p>
      {list.map((s) => (
        <ToolSummaryCard key={s.kind} summary={s} />
      ))}
    </section>
  );
}

// ─── Main content (embeddable) ────────────────────────────────────────────────
export function InsightsContent() {
  const ai = useAiReady();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  // The page starts with the tools the person chose. "Show everything" widens this one page; the saved choice stays.
  // Every pattern here is made from tarot readings, so there is something to show only when Tarot is among the tools.
  const tools = useChosenTools();
  const pathname = usePathname();
  const widened = useSearchParams().get(SHOW_ALL_PARAM) === "1";
  const shown = widened ? null : tools;
  const showsTarot = shown === null || shown.includes("tarot");
  const filterLine = <ToolFilterLine tools={tools} widened={widened} path={pathname} hidden={data?.hiddenReadings} noun="readings" />;

  useEffect(() => {
    setLoading(true);
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label="Loading insights" className="flex items-center justify-center py-20">
        <div aria-hidden="true" className="text-tone-400 text-2xl animate-pulse"><SigilMark /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-ink-faint text-sm py-10">
        Could not load patterns. Try refreshing.
      </div>
    );
  }

  const { totals, suitDistribution, recurringCards, mostClarified, topMajor, topMinor } = data;
  const hasData = totals.total_readings > 0;
  const archetypes = data.archetypes ?? [];
  const own = data.own ?? [];

  // Without tarot among the shown tools, the card patterns have nothing to say; the archetypes still do.
  if (shown && !showsTarot) {
    const archetypesView = <ArchetypesInReadings archetypes={archetypes} own={own} shown={shown} />;
    const anyArchetypes =
      archetypes.some((t) => shown.some((k) => (t.byTool[k]?.light ?? 0) + (t.byTool[k]?.shadow ?? 0) + (t.byTool[k]?.either ?? 0) > 0)) ||
      ownShownOf(own, shown).length > 0;
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        {filterLine}
        <AcrossTools shown={shown} />
        <OtherToolSummaries summaries={data.toolSummaries ?? []} shown={shown} />
        <ClothCountsInPatterns rows={data.clothCounts ?? []} shown={shown} />
        {anyArchetypes ? archetypesView : (
          <div className="text-center py-10 text-ink-faint">
            <p className="text-sm">
              Card patterns are made from tarot readings, and archetypes from every tool that has them. Nothing here for {toolNames(shown)} yet.
            </p>
            <Link
              href={toolFilterHref(pathname, true)}
              className="text-tone-400 hover:text-tone-300 text-sm mt-2 inline-block"
            >
              Show everything
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        {filterLine}
        <p className="text-sm text-ink-faint">
          {hasData
            ? `${totals.total_readings} reading${Number(totals.total_readings) !== 1 ? "s" : ""}, ${totals.spread_draws} card${Number(totals.spread_draws) !== 1 ? "s" : ""} drawn`
            : "No readings yet — start a reading to see your patterns here."}
        </p>
      </div>

      <AcrossTools shown={shown} />

      <OtherToolSummaries summaries={data.toolSummaries ?? []} shown={shown} />

      <ClothCountsInPatterns rows={data.clothCounts ?? []} shown={shown} />

      {!hasData && (
        <Link
          href="/readings/new"
          className="block bg-tone-700/20 border border-line-strong rounded-xl p-6 text-center hover:bg-tone-700/30 transition-colors"
        >
          <p className="text-sm text-tone-300">Start your first reading →</p>
        </Link>
      )}

      {!hasData && <ArchetypesInReadings archetypes={archetypes} own={own} shown={shown} />}

      {hasData && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Readings", value: String(totals.total_readings), sub: null },
              { label: "Cards Drawn", value: String(totals.spread_draws), sub: null },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-surface border border-line rounded-card p-4 text-center"
              >
                <div className="text-2xl font-bold text-tone-300">{s.value}</div>
                <div className="text-[10px] text-ink-ghost mt-1 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
            <div className="bg-surface border border-line rounded-card p-4 text-center">
              <div className="text-sm font-semibold text-tone-300 leading-tight min-h-[2rem] flex items-center justify-center">
                {topMajor ? topMajor.card_name : "—"}
              </div>
              {topMajor && (
                <div className="text-[9px] text-ink-faint mt-0.5">×{topMajor.total}</div>
              )}
              <div className="text-[10px] text-ink-ghost mt-1 uppercase tracking-widest">Top Major Arcana</div>
            </div>
            <div className="bg-surface border border-line rounded-card p-4 text-center">
              <div className="text-sm font-semibold text-tone-300 leading-tight min-h-[2rem] flex items-center justify-center">
                {topMinor ? topMinor.card_name : "—"}
              </div>
              {topMinor && (
                <div className="text-[9px] text-ink-faint mt-0.5">×{topMinor.total}</div>
              )}
              <div className="text-[10px] text-ink-ghost mt-1 uppercase tracking-widest">Top Minor Arcana</div>
            </div>
          </div>

          {/* Suit balance */}
          {suitDistribution.length > 0 && (
            <section aria-label="Suit balance" className="bg-surface border border-line rounded-card p-5">
              <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-4">Elemental Balance</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <SuitRing distribution={suitDistribution} size={140} />
                </div>
                <div className="flex-1 w-full">
                  <SuitLegend distribution={suitDistribution} />
                </div>
              </div>
            </section>
          )}

          {/* Recurring cards */}
          {recurringCards.length > 0 ? (
            <section aria-label="Recurring cards">
              <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-3">
                Recurring Cards
                <span className="ml-2 text-ink-faint font-normal normal-case tracking-normal">
                  — drawn 2 or more times
                </span>
              </h2>
              <div className="space-y-2">
                {recurringCards.map((card) => (
                  <RecurringCardRow key={card.card_id} card={card} />
                ))}
              </div>
            </section>
          ) : (
            <section className="text-sm text-ink-ghost text-center py-4">
              Draw more readings to see recurring cards here.
            </section>
          )}

          {/* Archetypes: shared by every tool */}
          <ArchetypesInReadings archetypes={archetypes} own={own} shown={shown} />

          {/* Most clarified */}
          {mostClarified.length > 0 && (
            <section aria-label="Most clarified positions">
              <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-3">
                Positions Sought Clarification On
              </h2>
              <div className="bg-surface border border-line rounded-card divide-y divide-tone-900/20">
                {mostClarified.map((c, i) => {
                  const fileName = cardFileName(c.card_id);
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="flex-shrink-0 overflow-hidden rounded border border-line w-[28px] h-[48px]"
                        aria-hidden="true"
                      >
                        {fileName ? (
                          <img src={`/cards/${fileName}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-canvas flex items-center justify-center text-tone-800 text-xs"><SigilMark /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-soft truncate">
                          {TAROT_DECK.find(t => t.id === c.card_id)?.name ?? c.card_id}
                        </p>
                        <p className="text-[10px] text-ink-ghost">{c.position_name}</p>
                      </div>
                      <span className="text-xs text-tone-500 flex-shrink-0">
                        {c.clarifier_count}× clarified
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Sky */}
          {data.sky && data.sky.byMoonPhase.length > 0 && (
            <section aria-label="Readings by sky">
              <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-1">Under Which Sky</h2>
              <p className="text-xs text-ink-ghost mb-3">
                Your readings grouped by moon phase and by day of the week, with the cards drawn most often in each.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <SkyGroupList title="By moon phase" groups={data.sky.byMoonPhase} symbols={MOON_SYMBOL} />
                <SkyGroupList title="By day" groups={data.sky.byDay} />
              </div>
            </section>
          )}

          {/* Hiero pattern reading (Claude): only with a Claude key that works, never in Feathered */}
          {ai.claude && <HieroPatternReading />}
        </>
      )}
    </div>
  );
}

// ─── Page wrapper (for /insights route) ──────────────────────────────────────
export default function InsightsPage() {
  return (
    <div className="px-4 py-8">
      <div className="max-w-3xl mx-auto mb-8">
        <BackLink href="/">
          ← Home
        </BackLink>
        <h1 className="text-2xl font-bold text-heading mt-1">Reading Patterns</h1>
      </div>
      <InsightsContent />
    </div>
  );
}
