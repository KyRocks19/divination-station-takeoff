"use client";

import MeaningsPanel from "@/components/MeaningsPanel";
import CommonMeaningBlock from "@/components/CommonMeaningBlock";
import { COMMON_SOURCES, OGHAM_MEANINGS } from "@/lib/common-meanings-data";
import { OGHAM_SOURCES, getStave, type Stave } from "@/lib/ogham-data";
import Cite from "@/components/sources/Cite";
import SymbolArchetypes from "@/components/SymbolArchetypes";

function Source({ text }: { text: string }) {
  return <p className="text-[11px] text-ink-faint leading-relaxed">{text}</p>;
}

/** The tradition's text for one stave, with where each piece comes from and how old it is. Opened only on a press. */
function TraditionalText({ stave }: { stave: Stave }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-ink-strong">
          {stave.name} <span className="text-ink-faint">· sound: {stave.sound}</span>
        </p>
        <Source text={OGHAM_SOURCES.ogham} />
        <Cite topic="ogham.ogham" tool="ogham" />
        {stave.aicme === 0 && <Source text={OGHAM_SOURCES.forfeda} />}
        {stave.aicme === 0 && <Cite topic="ogham.forfeda" tool="ogham" />}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">The name (medieval Irish texts)</p>
        <p className="text-sm text-ink-soft leading-relaxed">{stave.nameMeans}</p>
        <Source text={OGHAM_SOURCES.trees} />
        <Cite topic="ogham.trees" tool="ogham" />
      </div>

      {stave.kennings && (
        <div className="space-y-1">
          <p className="text-[10px] text-tone-400 uppercase tracking-widest">The word-ogham (medieval Irish texts)</p>
          <p className="text-sm text-ink-soft leading-relaxed">{stave.kennings}</p>
          <Source text={OGHAM_SOURCES.kennings} />
          <Cite topic="ogham.kennings" tool="ogham" />
        </div>
      )}

      {stave.laterName && (
        <div className="space-y-1">
          <p className="text-[10px] text-tone-400 uppercase tracking-widest">The later name (modern divination books)</p>
          <p className="text-sm text-ink-soft leading-relaxed">
            {stave.laterName.name}, {stave.laterName.means}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[10px] text-tone-400 uppercase tracking-widest">Modern divination (20th century)</p>
        {stave.modern && <p className="text-sm text-ink-soft leading-relaxed">{stave.modern}</p>}
        {stave.voices && (
          <ul className="list-none p-0 space-y-1.5 pt-1">
            {stave.voices.map((v) => (
              <li key={v.who} className="text-sm text-ink-soft leading-relaxed">
                <span className="text-ink-strong">{v.who}:</span> {v.text}
              </li>
            ))}
          </ul>
        )}
        <Source text={stave.voices ? OGHAM_SOURCES.forfedaModern : OGHAM_SOURCES.modern} />
        <Cite topic={stave.voices ? "ogham.forfeda-modern" : "ogham.modern"} tool="ogham" />
      </div>

      <Source text={OGHAM_SOURCES.summaries} />

      {OGHAM_MEANINGS[stave.id] && (
        <div className="space-y-1 border-t border-line-faint pt-4">
          <p className="text-[10px] text-tone-400 uppercase tracking-widest">Common meaning, in shared words</p>
          <CommonMeaningBlock meaning={OGHAM_MEANINGS[stave.id]} source={COMMON_SOURCES.ogham} symbolId={stave.id} />
        </div>
      )}

      {!OGHAM_MEANINGS[stave.id] && (
        <div className="space-y-1.5 border-t border-line-faint pt-4">
          <p className="text-[10px] text-tone-400 uppercase tracking-widest">Shared archetypes</p>
          <SymbolArchetypes symbolId={stave.id} slugs={[]} />
        </div>
      )}
    </div>
  );
}

interface Props {
  staveId: string;
}

/** A stave's meanings: the person's own words first, with every earlier version; the tradition's text on a button. */
export default function StaveMeanings({ staveId }: Props) {
  const stave = getStave(staveId);
  if (!stave) return null;
  // Staves never land upside down, so only the upright side is shown.
  return (
    <MeaningsPanel
      cardId={staveId}
      orientation="upright"
      api={`/api/ogham/meanings/${encodeURIComponent(staveId)}`}
      stockLabel="Traditional Meanings"
      stockSection={<TraditionalText stave={stave} />}
      noun="stave"
    />
  );
}
