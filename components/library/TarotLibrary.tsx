"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ConceptNote, SensitiveMeaningsToggle } from "@/components/SensitiveMeanings";
import Link from "next/link";
import { TAROT_DECK, type TarotCard } from "@/lib/cards";
import { parseDate, toISOString } from "@/lib/date";
import TagManager, { type Tag } from "@/components/TagManager";
import { InsightsContent } from "@/app/insights/page";
import { EncyclopediaContent } from "@/app/encyclopedia/page";
import { SUIT_META } from "@/lib/suit-meta";
import CardStructure from "@/components/CardStructure";
import MeaningsPanel from "@/components/MeaningsPanel";
import { styleRef } from "@/lib/apply-style";

type LibraryTab = "cards" | "patterns" | "encyclopedia";

const TABS: { id: LibraryTab; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "patterns", label: "Patterns" },
  { id: "encyclopedia", label: "Encyclopedia" },
];

// ─── Constants ────────────────────────────────────────────────────────────────
const SUIT_ORDER = ["major", "cups", "wands", "swords", "pentacles"] as const;

const SUIT_LABELS: Record<string, string> = {
  major: "Major Arcana",
  cups: "Cups",
  wands: "Wands",
  swords: "Swords",
  pentacles: "Pentacles",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DrawRecord {
  reading_id: number;
  title: string | null;
  spread_name: string;
  question: string | null;
  position_name: string;
  reversed: boolean;
  created_at: string;
}

interface CardHistory {
  total: number;
  draws: DrawRecord[];
}

interface ConceptRow {
  id: number;
  name: string;
  display_name: string;
  card_count: number;
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  card,
  history,
  loading,
  onClose,
}: {
  card: TarotCard;
  history: CardHistory | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [cardTags, setCardTags] = useState<Tag[]>([]);
  const [concepts, setConcepts] = useState<{ upright: ConceptRow[]; reversed: ConceptRow[]; sensitive?: number; showing?: boolean }>({ upright: [], reversed: [] });
  function reloadConcepts() {
    fetch(`/api/cards/${encodeURIComponent(card.id)}/concepts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => { if (rows) setConcepts(rows); })
      .catch(() => {});
  }
  const loadedCardId = useRef<string | null>(null);

  useEffect(() => {
    if (loadedCardId.current === card.id) return;
    loadedCardId.current = card.id;
    fetch(`/api/cards/${encodeURIComponent(card.id)}/tags`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCardTags)
      .catch(() => {});
    fetch(`/api/cards/${encodeURIComponent(card.id)}/concepts`)
      .then((r) => r.ok ? r.json() : { upright: [], reversed: [] })
      .then(setConcepts)
      .catch(() => {});
  }, [card]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Used here, so it is not one press of the quick exit's Esc Esc (components/QuickExitTriggers.tsx).
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        className="fixed right-0 top-0 h-full w-full max-w-[22rem] bg-canvas border-l border-line-strong z-50 overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Sticky header */}
        <div className="sticky top-0 bg-canvas/95 backdrop-blur border-b border-line-faint px-5 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <p className="text-[10px] text-tone-500 uppercase tracking-widest">
              {SUIT_LABELS[card.suit]}
            </p>
            <h2 className="text-lg font-semibold text-ink-strong leading-tight">{card.name}</h2>
            {history && history.total > 0 && (
              <p className="text-[10px] text-ink-faint mt-0.5">
                Drawn {history.total}× in your history
              </p>
            )}
            <Link
              href={`/cards/${encodeURIComponent(card.id)}`}
              className="text-[10px] text-ink-ghost hover:text-tone-400 transition-colors mt-1 inline-block"
            >
              View full card page →
            </Link>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-ink-ghost hover:text-ink-soft transition-colors text-xl leading-none mt-1 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 p-5 space-y-7">
          {/* Full card image */}
          <div className="flex justify-center">
            <div
              className="rounded-xl overflow-hidden border border-line-strong shadow-xl w-[160px]"
            >
              <img
                src={`/cards/${card.fileName}`}
                alt={card.name}
                className="w-full h-auto block"
              />
            </div>
          </div>

          <CardStructure cardId={card.id} />

          {/* Meanings: the user's own first, built-in text on request */}
          <MeaningsPanel cardId={card.id}>
          <SensitiveMeaningsToggle showing={concepts.showing === true} count={concepts.sensitive ?? 0} onChanged={reloadConcepts} />
          {(concepts.upright.length > 0 || concepts.reversed.length > 0) && (
            <div className="space-y-4">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">
                Concepts
              </p>
              <ConceptNote />
              {concepts.upright.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-tone-400 uppercase tracking-widest">Upright</p>
                  <div className="flex flex-wrap gap-1.5">
                    {concepts.upright.map((c) => (
                      <Link
                        key={c.id}
                        href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                        className="text-[11px] text-ink-muted hover:text-tone-200 border border-line-faint hover:border-line-hover bg-field rounded px-2 py-1 transition-colors"
                      >
                        {c.display_name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {concepts.reversed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-danger uppercase tracking-widest">Reversed</p>
                  <div className="flex flex-wrap gap-1.5">
                    {concepts.reversed.map((c) => (
                      <Link
                        key={c.id}
                        href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                        className="text-[11px] text-ink-faint hover:text-danger-soft border border-danger/10 hover:border-danger/40 bg-field rounded px-2 py-1 transition-colors"
                      >
                        {c.display_name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </MeaningsPanel>

          {/* Tags */}
          <div>
            <p className="text-[10px] text-ink-faint uppercase tracking-widest mb-2">Tags</p>
            <TagManager entityType="card" entityId={card.id} initialTags={cardTags} />
          </div>

          {/* Draw history */}
          <div>
            <p className="text-[10px] text-ink-faint uppercase tracking-widest mb-4">
              Your History
            </p>

            {loading && (
              <p className="text-xs text-ink-ghost animate-pulse">Loading…</p>
            )}

            {!loading && history?.total === 0 && (
              <p className="text-xs text-ink-ghost italic">You haven&rsquo;t drawn this card yet.</p>
            )}

            {!loading && history && history.draws.length > 0 && (
              <ol className="space-y-3" aria-label={`Draw history for ${card.name}`}>
                {history.draws.map((d, i) => (
                  <li
                    key={i}
                    className="bg-surface border border-line-faint rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/readings/${d.reading_id}`}
                        className="text-xs font-medium text-accent-ink hover:text-accent-ink-hover transition-colors leading-snug"
                      >
                        {d.title || d.spread_name}
                      </Link>
                      <time
                        className="text-[10px] text-ink-ghost whitespace-nowrap flex-shrink-0"
                        dateTime={toISOString(d.created_at)}
                      >
                        {parseDate(d.created_at).toLocaleDateString()}
                      </time>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] bg-tone-900/30 text-tone-500 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        {d.position_name}
                      </span>
                      {d.reversed && (
                        <span className="text-[9px] text-danger bg-danger/10 rounded px-1.5 py-0.5">
                          Reversed
                        </span>
                      )}
                    </div>

                    {d.question && (
                      <p className="text-[10px] text-ink-ghost italic line-clamp-2">
                        &ldquo;{d.question}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Card type helpers ────────────────────────────────────────────────────────
type CardType = "major" | "ace" | "pip" | "court";

function getCardType(card: TarotCard): CardType {
  if (card.suit === "major") return "major";
  const rank = card.id.split("-")[1];
  if (rank === "ace") return "ace";
  if (["page", "knight", "queen", "king"].includes(rank)) return "court";
  return "pip";
}

const TYPE_FILTERS: { id: CardType | null; label: string }[] = [
  { id: null,    label: "All" },
  { id: "ace",   label: "Aces" },
  { id: "pip",   label: "2–10" },
  { id: "court", label: "Court" },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TarotLibrary() {
  const [tab, setTab] = useState<LibraryTab>("cards");
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [selectedCard, setSelectedCard] = useState<TarotCard | null>(null);
  const [history, setHistory] = useState<CardHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [suitFilter, setSuitFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<CardType | null>(null);

  // Fetch all draw counts once
  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => setCardCounts(d.cardCounts ?? {}))
      .catch(() => {});
  }, []);

  const openCard = useCallback(async (card: TarotCard) => {
    setSelectedCard(card);
    setHistory(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(card.id)}`);
      const data = await res.json();
      setHistory(data);
    } catch {
      setHistory({ total: 0, draws: [] });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelectedCard(null);
    setHistory(null);
  }, []);

  const totalDrawn = Object.keys(cardCounts).length;

  // Derived filtered card list for display
  const visibleSections = useMemo(() => {
    const result: { suit: string; cards: TarotCard[] }[] = [];
    for (const suit of SUIT_ORDER) {
      if (suitFilter && suit !== suitFilter) continue;
      let cards = TAROT_DECK.filter((c) => c.suit === suit);
      if (typeFilter) {
        if (suit === "major") continue; // major arcana has no ace/pip/court
        cards = cards.filter((c) => getCardType(c) === typeFilter);
      }
      if (cards.length > 0) result.push({ suit, cards });
    }
    return result;
  }, [suitFilter, typeFilter]);

  const totalVisible = visibleSections.reduce((sum, s) => sum + s.cards.length, 0);

  return (
    <section id="tarot-library" aria-labelledby="tarot-library-heading" className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 id="tarot-library-heading" className="text-xl font-bold text-heading">Tarot</h2>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 mb-8 border-b border-line pb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`text-xs px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg transition-colors ${
              tab === t.id
                ? "bg-tone-800/60 text-tone-200 font-medium"
                : "text-ink-muted hover:text-ink-strong bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cards tab */}
      {tab === "cards" && (
        <>
          {/* Filters */}
          <div className="space-y-2.5 mb-6">
            {/* Suit / element filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-ink-ghost uppercase tracking-widest w-10 shrink-0">Suit</span>
              <button
                onClick={() => setSuitFilter(null)}
                aria-pressed={suitFilter === null}
                className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
                  suitFilter === null
                    ? "bg-tone-900/50 border-line-accent text-tone-200"
                    : "border-line text-ink-faint hover:text-ink-soft bg-surface"
                }`}
              >
                All
              </button>
              {Object.entries(SUIT_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setSuitFilter(suitFilter === key ? null : key)}
                  aria-pressed={suitFilter === key}
                  className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
                    suitFilter === key
                      ? "border-current"
                      : "border-line text-ink-faint hover:text-ink-soft bg-surface"
                  }`}
                  ref={styleRef(
                    suitFilter === key
                      ? { borderColor: meta.color, backgroundColor: `${meta.color}22`, color: meta.color }
                      : {}
                  )}
                >
                  {meta.label}
                  <span className="ml-1 text-[10px]">{meta.element}</span>
                </button>
              ))}
            </div>

            {/* Card type filter (minor arcana only) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-ink-ghost uppercase tracking-widest w-10 shrink-0">Type</span>
              {TYPE_FILTERS.map((f) => (
                <button
                  key={String(f.id)}
                  onClick={() => setTypeFilter(typeFilter === f.id ? null : f.id)}
                  className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
                    typeFilter === f.id
                      ? "bg-tone-900/50 border-line-accent text-tone-200"
                      : "border-line text-ink-faint hover:text-ink-soft bg-surface"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-ink-faint mb-8">
            {totalVisible === 78 ? "All 78 cards" : `${totalVisible} cards`}
            {totalDrawn > 0 && (
              <span className="text-ink-faint"> · {totalDrawn} drawn in your history</span>
            )}
          </p>

          <div className="space-y-12">
            {visibleSections.map(({ suit, cards }) => (
              <section key={suit} aria-label={SUIT_LABELS[suit]}>
                <h2 className="text-xs text-ink-faint uppercase tracking-widest mb-4">
                  {SUIT_LABELS[suit]}
                  <span className="ml-2 text-ink-ghost font-normal normal-case tracking-normal">
                    — {cards.length} cards
                  </span>
                </h2>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2.5">
                  {cards.map((card) => {
                    const count = cardCounts[card.id] ?? 0;
                    const isSelected = selectedCard?.id === card.id;

                    return (
                      <button
                        key={card.id}
                        onClick={() => openCard(card)}
                        aria-label={`${card.name}${count > 0 ? `, drawn ${count} times` : ", not yet drawn"}`}
                        aria-pressed={isSelected}
                        className={`relative group rounded-lg overflow-hidden border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tone-400 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas ${
                          isSelected
                            ? "border-tone-400 ring-2 ring-tone-500/60 shadow-lg shadow-tone-900/40"
                            : count > 0
                            ? "border-line-strong hover:border-line-hover"
                            : "border-line-faint hover:border-line-hover opacity-70 hover:opacity-100"
                        }`}
                      >
                        <div className="aspect-[57/100] bg-canvas">
                          <img
                            src={`/cards/${card.fileName}`}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>

                        {count > 0 && (
                          <div
                            aria-hidden="true"
                            className="absolute top-1 right-1 bg-tone-700/90 text-white text-[8px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center leading-none shadow"
                          >
                            {count > 99 ? "99+" : count}
                          </div>
                        )}

                        <div
                          aria-hidden="true"
                          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <p className="text-[8px] text-ink-strong text-center leading-tight font-medium line-clamp-2">
                            {card.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {selectedCard && (
            <DetailPanel
              card={selectedCard}
              history={history}
              loading={historyLoading}
              onClose={closePanel}
            />
          )}
        </>
      )}

      {/* Patterns tab */}
      {tab === "patterns" && <InsightsContent />}

      {/* Encyclopedia tab */}
      {tab === "encyclopedia" && <EncyclopediaContent />}
    </section>
  );
}
