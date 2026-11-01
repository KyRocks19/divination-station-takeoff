"use client";

import { useEffect, useState, use } from "react";
import { ConceptNote, SensitiveMeaningsToggle } from "@/components/SensitiveMeanings";
import Link from "next/link";
import { TAROT_DECK } from "@/lib/cards";
import { parseDate, toISOString } from "@/lib/date";
import CardStructure from "@/components/CardStructure";
import MeaningsPanel from "@/components/MeaningsPanel";
import { BackLink, SectionLabel } from "@/components/ui/Page";

interface ConceptRow {
  id: number;
  name: string;
  display_name: string;
  card_count: number;
}

interface ConceptsByPolarity {
  upright: ConceptRow[];
  reversed: ConceptRow[];
  /** How many of this card's concepts are sensitive, and whether this person is seeing them. */
  sensitive?: number;
  showing?: boolean;
}

interface DrawRecord {
  reading_id: number;
  title: string | null;
  spread_name: string;
  question: string | null;
  position_name: string;
  reversed: boolean;
  created_at: string;
}

interface OwnWords {
  id: number;
  content: string;
  kind: string | null;
  created_at: string;
  reading_id: number;
  title: string | null;
  spread_name: string;
}

export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const staticCard = TAROT_DECK.find((c) => c.id === id);

  const [concepts, setConcepts] = useState<ConceptsByPolarity>({ upright: [], reversed: [] });
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [ownWords, setOwnWords] = useState<OwnWords[]>([]);
  const [loading, setLoading] = useState(true);

  function reloadConcepts() {
    fetch(`/api/cards/${encodeURIComponent(id)}/concepts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => { if (rows) setConcepts(rows); })
      .catch(() => {});
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/cards/${encodeURIComponent(id)}/concepts`).then((r) => (r.ok ? r.json() : { upright: [], reversed: [] })),
      fetch(`/api/library/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : { draws: [] })),
      fetch(`/api/cards/${encodeURIComponent(id)}/revisions`).then((r) => (r.ok ? r.json() : { impressions: [] })),
    ]).then(([conceptRows, history, words]) => {
      setConcepts(conceptRows ?? { upright: [], reversed: [] });
      setDraws(history?.draws ?? []);
      setOwnWords(words?.impressions ?? []);
      setLoading(false);
    });
  }, [id]);

  if (!staticCard) {
    return (
      <div className="max-w-page mx-auto px-4 py-8">
        <p className="text-ink-ghost">Card not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-page mx-auto px-4 py-8 space-y-10">
      {/* Back */}
      <BackLink href="/library">
        ← The Library
      </BackLink>

      {/* Header */}
      <div className="flex gap-8 items-start">
        <div
          className="shrink-0 rounded-xl overflow-hidden border border-line-strong shadow-xl shadow-tone-900/50 w-[140px]"
        >
          <img
            src={`/cards/${staticCard.fileName}`}
            alt={staticCard.name}
            className="w-full h-auto block"
          />
        </div>

        <div className="space-y-3 pt-1 min-w-0">
          <h1 className="text-3xl font-bold text-tone-100">{staticCard.name}</h1>
          {draws.length > 0 && (
            <p className="text-xs text-ink-faint">
              Drawn {draws.length} time{draws.length !== 1 ? "s" : ""} in your history
            </p>
          )}
        </div>
      </div>

      {/* Number, suit, associations */}
      <CardStructure cardId={id} detail="full" />

      {/* Meanings: yours first, built-in text on request */}
      <section className="space-y-3">
        <SectionLabel>Meanings</SectionLabel>
        <MeaningsPanel cardId={id}>
          <SensitiveMeaningsToggle showing={concepts.showing === true} count={concepts.sensitive ?? 0} onChanged={reloadConcepts} />
          {(concepts.upright.length > 0 || concepts.reversed.length > 0) && (
            <div className="space-y-3 pt-2 border-t border-line-faint">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">
                Concepts ({concepts.upright.length + concepts.reversed.length})
              </p>
              <ConceptNote />

              {concepts.upright.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-ink-faint uppercase tracking-widest">Upright</p>
                  <div className="flex flex-wrap gap-2">
                    {concepts.upright.map((c) => (
                      <Link
                        key={c.id}
                        href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                        className="text-sm text-ink-soft hover:text-tone-200 border border-line hover:border-line-hover bg-surface rounded-lg px-3 py-1.5 min-h-11 sm:min-h-0 max-sm:inline-flex max-sm:items-center transition-colors"
                      >
                        {c.display_name}
                        <span className="ml-1.5 text-[10px] text-ink-ghost">{c.card_count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {concepts.reversed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-danger uppercase tracking-widest">Reversed</p>
                  <div className="flex flex-wrap gap-2">
                    {concepts.reversed.map((c) => (
                      <Link
                        key={c.id}
                        href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                        className="text-sm text-ink-muted hover:text-danger-soft border border-danger/10 hover:border-danger/40 bg-surface rounded-lg px-3 py-1.5 min-h-11 sm:min-h-0 transition-colors"
                      >
                        {c.display_name}
                        <span className="ml-1.5 text-[10px] text-ink-ghost">{c.card_count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </MeaningsPanel>
      </section>

      {/* What the user has written about this card across readings */}
      {!loading && ownWords.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>
            What you wrote when this card came up
            <span className="ml-2 font-normal normal-case tracking-normal">— {ownWords.length}</span>
          </SectionLabel>
          <ol className="space-y-3">
            {ownWords.map((w) => (
              <li key={w.id} className="border-l-2 border-line-hover pl-3 space-y-1">
                <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap">{w.content}</p>
                <p className="text-[10px] text-ink-ghost">
                  <time dateTime={toISOString(w.created_at)}>{parseDate(w.created_at).toLocaleDateString()}</time>
                  {" · "}
                  <Link href={`/readings/${w.reading_id}`} className="text-tone-500 hover:text-tone-300 transition-colors">
                    {w.title || w.spread_name}
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reading history */}
      {!loading && (
        <section className="space-y-3">
          <SectionLabel>
            Reading history
            {draws.length > 0 && <span className="ml-2 font-normal normal-case tracking-normal">— {draws.length} appearance{draws.length !== 1 ? "s" : ""}</span>}
          </SectionLabel>

          {draws.length === 0 ? (
            <p className="text-sm text-ink-ghost italic">
              This card hasn&rsquo;t appeared in any of your readings yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {draws.map((d, i) => (
                <li
                  key={i}
                  className="bg-surface border border-line-faint rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/readings/${d.reading_id}`}
                      className="text-sm font-medium text-accent-ink hover:text-accent-ink-hover transition-colors leading-snug"
                    >
                      {d.title || d.spread_name}
                    </Link>
                    <time
                      className="text-[10px] text-ink-ghost whitespace-nowrap shrink-0"
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
                    <p className="text-[11px] text-ink-ghost italic line-clamp-2">
                      &ldquo;{d.question}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
