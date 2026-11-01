"use client";

import MeaningsPanel from "@/components/MeaningsPanel";
import CommonMeaningBlock from "@/components/CommonMeaningBlock";
import { COMMON_SOURCES, RUNE_MEANINGS } from "@/lib/common-meanings-data";
import { RUNE_SOURCES, getRune, type Rune } from "@/lib/runes-data";
import Cite from "@/components/sources/Cite";

function Source({ text }: { text: string }) {
  return <p className="text-[11px] text-ink-faint leading-relaxed">{text}</p>;
}

/** The tradition's text for one rune, with where each piece comes from and how old it is. Opened only on a press. */
function TraditionalText({ rune }: { rune: Rune }) {
  const poems = [
    { key: "oe", title: "Old English poem", text: rune.oe, source: RUNE_SOURCES.oe },
    { key: "no", title: "Norwegian poem", text: rune.no, source: RUNE_SOURCES.no },
    { key: "ic", title: "Icelandic poem", text: rune.ic, source: RUNE_SOURCES.ic },
  ].filter((p) => p.text);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-ink-strong">
          {rune.name} <span className="text-ink-faint">· sound: {rune.sound} · name means: {rune.nameMeans}</span>
        </p>
        <Source text={RUNE_SOURCES.futhark} />
        <Cite topic="runes.futhark" tool="runes" />
      </div>

      {poems.map((p) => (
        <div key={p.key} className="space-y-1">
          <p className="text-[10px] text-tone-400 uppercase tracking-widest">{p.title}</p>
          <p className="text-sm text-ink-soft leading-relaxed">{p.text}</p>
          <Source text={p.source} />
          {p.key === "oe" && <Cite topic="runes.oe" tool="runes" />}
        </div>
      ))}

      <div className="space-y-1">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">Modern divination (20th century)</p>
        <p className="text-sm text-ink-soft leading-relaxed">{rune.modern}</p>
        <Source text={RUNE_SOURCES.modern} />
        <Cite topic="runes.magic" tool="runes" />
      </div>

      <Source text={RUNE_SOURCES.summaries} />

      {RUNE_MEANINGS[rune.id] && (
        <div className="space-y-1 border-t border-line-faint pt-4">
          <p className="text-[10px] text-tone-400 uppercase tracking-widest">Common meaning, in shared words</p>
          <CommonMeaningBlock meaning={RUNE_MEANINGS[rune.id]} source={COMMON_SOURCES.rune} symbolId={rune.id} />
        </div>
      )}
    </div>
  );
}

interface Props {
  runeId: string;
  /** Show only one side. Leave out to show both. */
  orientation?: "upright" | "reversed";
}

/** A rune's meanings: the person's own words first, with every earlier version; the tradition's text on a button. */
export default function RuneMeanings({ runeId, orientation }: Props) {
  const rune = getRune(runeId);
  if (!rune) return null;
  return (
    <MeaningsPanel
      cardId={runeId}
      orientation={orientation}
      api={`/api/runes/meanings/${encodeURIComponent(runeId)}`}
      stockLabel="Traditional Meanings"
      stockSection={<TraditionalText rune={rune} />}
      noun="rune"
    />
  );
}
