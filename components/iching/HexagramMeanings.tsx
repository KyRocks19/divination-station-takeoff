"use client";

import MeaningsPanel from "@/components/MeaningsPanel";
import Cite from "@/components/sources/Cite";
import { ICHING_SOURCES, getHexagram, getTrigram, trigramWords } from "@/lib/iching-data";
import Hanzi from "@/components/ui/Hanzi";

function Source({ text }: { text: string }) {
  return <p className="text-[11px] text-ink-faint leading-relaxed">{text}</p>;
}

/** What the tradition fixes about one hexagram (its number, name and trigrams), and where that comes from. Opened only on a press. */
function TraditionalText({ n }: { n: number }) {
  const h = getHexagram(n)!;
  const lower = getTrigram(h.lower)!;
  const upper = getTrigram(h.upper)!;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-ink-strong">
          Hexagram {h.n}: <Hanzi>{h.char}</Hanzi> {h.pinyin} <span className="text-ink-faint">· usual English name: {h.english}</span>
        </p>
        <p className="text-sm text-ink-soft leading-relaxed">
          {trigramWords(h)}: <Hanzi>{upper.char}</Hanzi> {upper.pinyin} ({upper.english}) above, <Hanzi>{lower.char}</Hanzi> {lower.pinyin} ({lower.english}) below.
        </p>
        <Source text={ICHING_SOURCES.hexagrams} />
        <Cite topic="iching.hexagrams" tool="iching" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">The old texts</p>
        <Source text={ICHING_SOURCES.texts} />
        <Cite topic="iching.texts" tool="iching" />
      </div>
    </div>
  );
}

/** A hexagram's meaning: the person's own words first, with every earlier version; what the tradition fixes about it on a button. */
export default function HexagramMeanings({ hexagram }: { hexagram: number }) {
  const h = getHexagram(hexagram);
  if (!h) return null;
  return (
    <MeaningsPanel
      cardId={h.id}
      orientation="upright"
      api={`/api/iching/meanings/${encodeURIComponent(h.id)}`}
      stockLabel="What the tradition fixes"
      stockSection={<TraditionalText n={h.n} />}
      noun="hexagram"
    />
  );
}
