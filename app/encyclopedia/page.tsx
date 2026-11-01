"use client";

import { useEffect, useId, useState, useMemo, lazy, Suspense } from "react";
import Link from "next/link";
import { SUIT_META } from "@/lib/suit-meta";
import { NO_REALM, matchesRealm, realmChoices } from "@/lib/concept-realm-core";
import { PageTitle } from "@/components/ui/Page";
import { Select } from "@/components/ui/Field";
import { styleRef } from "@/lib/apply-style";
import { SensitiveMeaningsBar } from "@/components/SensitiveMeanings";

const ConceptGraph = lazy(() => import("@/components/encyclopedia/ConceptGraph"));
const ConceptCluster = lazy(() => import("@/components/encyclopedia/ConceptCluster"));
const CardWeb = lazy(() => import("@/components/encyclopedia/CardWeb"));
const ConceptCloud = lazy(() => import("@/components/encyclopedia/ConceptCloud"));
const ZodiacWheel = lazy(() => import("@/components/encyclopedia/ZodiacWheel"));
const ElementMap = lazy(() => import("@/components/encyclopedia/ElementMap"));

export type View = "graph" | "cluster" | "web" | "cloud" | "list" | "zodiac" | "element";
type Polarity = "all" | "upright" | "reversed";

interface Concept {
  id: number;
  name: string;
  display_name: string;
  card_count: number;
  upright_count: number;
  reversed_count: number;
  dominant_suit?: string;
  /** The older wording of a reworded concept: the list's search finds it, nothing shows it. */
  aliases?: string[];
  /** Its own realm, or its first archetype's when it has none of its own (lib/concept-realm-core.ts). */
  realm?: string | null;
}

// ─── Suit filter pill row ─────────────────────────────────────────────────────
function SuitFilterBar({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <button
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
          value === null
            ? "bg-tone-900/50 border-line-accent text-tone-200"
            : "border-line text-ink-faint hover:text-ink-soft bg-surface"
        }`}
      >
        All
      </button>
      {Object.entries(SUIT_META).map(([key, meta]) => (
        <button
          key={key}
          onClick={() => onChange(value === key ? null : key)}
          aria-pressed={value === key}
          className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
            value === key
              ? "border-current text-white"
              : "border-line text-ink-faint hover:text-ink-soft bg-surface"
          }`}
          ref={styleRef(value === key ? { borderColor: meta.color, backgroundColor: `${meta.color}22`, color: meta.color } : {})}
        >
          {meta.label}
          <span className="ml-1 text-[10px]">{meta.element}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Polarity filter row ──────────────────────────────────────────────────────
function PolarityFilterBar({
  value,
  onChange,
}: {
  value: Polarity;
  onChange: (v: Polarity) => void;
}) {
  const opts: { id: Polarity; label: string }[] = [
    { id: "all",      label: "All" },
    { id: "upright",  label: "Upright" },
    { id: "reversed", label: "Reversed" },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
            value === o.id
              ? o.id === "reversed"
                ? "bg-danger/25 border-danger/60 text-danger-soft"
                : "bg-tone-900/50 border-line-accent text-tone-200"
              : "border-line text-ink-faint hover:text-ink-soft bg-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main content (embeddable) ────────────────────────────────────────────────
/** `views` limits the choice of views (all of them when left out) and `start` is the one shown first. */
export function EncyclopediaContent({ views, start = "list" }: { views?: View[]; start?: View } = {}) {
  const [view, setView] = useState<View>(start);
  const realmId = useId();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [graphData, setGraphData] = useState<any>(null);
  const [cardConcepts, setCardConcepts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [suitFilter, setSuitFilter] = useState<string | null>(null);
  const [realmFilter, setRealmFilter] = useState("");
  const [polarity, setPolarity] = useState<Polarity>("all");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setLoading(true);
    const url = polarity !== "all"
      ? `/api/encyclopedia/concepts?polarity=${polarity}`
      : "/api/encyclopedia/concepts";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setConcepts(data);
        setLoading(false);
      });
  }, [polarity, reload]);

  useEffect(() => {
    if (view === "graph" && !graphData) {
      fetch("/api/encyclopedia/graph").then((r) => r.json()).then(setGraphData);
    }
    if (view === "web" && cardConcepts.length === 0) {
      fetch("/api/encyclopedia/card-concepts").then((r) => r.json()).then(setCardConcepts);
    }
  }, [view, graphData, cardConcepts.length]);

  const filtered = useMemo(() => {
    let result = concepts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.display_name.toLowerCase().includes(q) || (c.aliases ?? []).some((a) => a.toLowerCase().includes(q)));
    }
    if (suitFilter) {
      result = result.filter((c) => c.dominant_suit === suitFilter);
    }
    if (realmFilter) {
      result = result.filter((c) => matchesRealm(c.realm ?? null, realmFilter));
    }
    return result;
  }, [concepts, search, suitFilter, realmFilter]);
  const realms = useMemo(() => realmChoices(concepts.map((c) => c.realm)), [concepts]);

  const ALL_VIEWS: { id: View; label: string }[] = [
    { id: "list",    label: "List" },
    { id: "graph",   label: "Graph" },
    { id: "cluster", label: "Cluster" },
    { id: "web",     label: "Card Web" },
    { id: "cloud",   label: "Cloud" },
    { id: "zodiac",  label: "Zodiac" },
    { id: "element", label: "Elements" },
  ];
  const VIEWS = views ? ALL_VIEWS.filter((v) => views.includes(v.id)) : ALL_VIEWS;

  return (
    <div className="space-y-5">
      <SensitiveMeaningsBar
        onChanged={() => {
          // The graph and the card web are read again the next time they are opened.
          setGraphData(null);
          setCardConcepts([]);
          setReload((n) => n + 1);
        }}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-ink-faint">
          {view === "zodiac" || view === "element"
            ? null
            : loading ? "Loading…" : `${filtered.length} of ${concepts.length} concepts`}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={`text-xs px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg transition-colors ${
                view === v.id
                  ? "bg-tone-800/60 text-tone-200 font-medium"
                  : "text-ink-muted hover:text-ink-strong bg-surface"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Polarity + suit filters — not needed for static association views */}
      {view !== "zodiac" && view !== "element" && (
        <>
          <PolarityFilterBar value={polarity} onChange={setPolarity} />
          <SuitFilterBar value={suitFilter} onChange={setSuitFilter} />
        </>
      )}

      {/* Text search (list + cluster + cloud) */}
      {(view === "list" || view === "cluster" || view === "cloud") && (
        <div className="flex flex-wrap items-end gap-3">
          <input
            type="text"
            placeholder="Search concepts…" aria-label="Search concepts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface border border-line-strong text-ink-strong text-sm rounded-lg px-4 py-2 min-h-11 sm:min-h-0 focus:outline-none focus:border-focus w-full max-w-sm"
          />
          {realms.length > 0 && (
            <div>
              <label htmlFor={realmId} className="block text-xs text-ink-faint mb-0.5">Realm</label>
              <Select id={realmId} value={realmFilter} onChange={(e) => setRealmFilter(e.target.value)}>
                <option value="">All realms</option>
                {realms.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value={NO_REALM}>No realm yet</option>
              </Select>
            </div>
          )}
        </div>
      )}

      <Suspense fallback={<Spinner />}>
        {view === "list" && <ListView concepts={filtered} loading={loading} polarity={polarity} />}
        {view === "graph" && graphData && <ConceptGraph data={graphData} suitFilter={suitFilter} polarity={polarity} />}
        {view === "graph" && !graphData && <Spinner />}
        {view === "cluster" && <ConceptCluster concepts={filtered} />}
        {view === "web" && cardConcepts.length > 0 && <CardWeb cardConcepts={cardConcepts} />}
        {view === "web" && cardConcepts.length === 0 && <Spinner />}
        {view === "cloud" && <ConceptCloud concepts={filtered} />}
        {view === "zodiac" && <ZodiacWheel />}
        {view === "element" && <ElementMap />}
      </Suspense>
    </div>
  );
}

// ─── Page wrapper (for /encyclopedia route) ───────────────────────────────────
export default function EncyclopediaPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <PageTitle>Encyclopedia Arcana</PageTitle>
      <EncyclopediaContent />
    </div>
  );
}

function ListView({
  concepts,
  loading,
  polarity,
}: {
  concepts: Concept[];
  loading: boolean;
  polarity: Polarity;
}) {
  if (loading) return <Spinner />;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
      {concepts.map((c) => {
        const color = SUIT_META[c.dominant_suit ?? "major"]?.color ?? "#7c3aed";
        const isReversedOnly = c.reversed_count > 0 && c.upright_count === 0;
        const isBoth = c.reversed_count > 0 && c.upright_count > 0;
        return (
          <Link
            key={c.id}
            href={`/encyclopedia/${encodeURIComponent(c.name)}`}
            className={`group bg-surface rounded-lg px-3 py-2.5 transition-colors border ${
              isReversedOnly
                ? "border-danger/10 hover:border-danger/40"
                : "border-line-faint hover:border-line-hover"
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm text-ink-strong group-hover:text-tone-200 transition-colors leading-snug [overflow-wrap:anywhere]">
                {c.display_name}
              </p>
              {isReversedOnly && (
                <span className="text-[8px] text-danger/70 shrink-0 mt-0.5">↓</span>
              )}
              {isBoth && polarity === "all" && (
                <span className="text-[8px] text-ink-ghost shrink-0 mt-0.5">↕</span>
              )}
            </div>
            <p className="text-xs mt-0.5 text-ink-faint">
              {polarity === "reversed" ? c.reversed_count : polarity === "upright" ? c.upright_count : c.card_count}{" "}
              card{(polarity === "reversed" ? c.reversed_count : polarity === "upright" ? c.upright_count : c.card_count) !== 1 ? "s" : ""}
            </p>
            {c.realm && <p className="text-[10px] mt-0.5 text-ink-ghost [overflow-wrap:anywhere]">{c.realm}</p>}
          </Link>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 text-ink-ghost">
      <span className="text-sm animate-pulse">Loading…</span>
    </div>
  );
}
