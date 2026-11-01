"use client";

import MeaningsPanel from "@/components/MeaningsPanel";
import Cite from "@/components/sources/Cite";
import { GEOMANCY_SOURCES, LINE_ELEMENTS, dotRows, getFigure, type Figure } from "@/lib/geomancy-data";

function Source({ text }: { text: string }) {
  return <p className="text-[11px] text-ink-faint leading-relaxed">{text}</p>;
}

/** What the sources fix about one figure (its Latin name, the meaning of that name and its dots), and where that comes from. Opened only on a press. */
function TraditionalText({ figure }: { figure: Figure }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-ink-strong">
          {figure.latin} <span className="text-ink-faint">· the Latin means: {figure.english}</span>
        </p>
        <ul className="list-none p-0 text-sm text-ink-soft">
          {dotRows(figure).map((row, i) => (
            <li key={i}>
              {LINE_ELEMENTS[i]}: {row}
            </li>
          ))}
        </ul>
        <Source text={GEOMANCY_SOURCES.figures} />
        <Cite topic="geomancy.figures" tool="geomancy" />
      </div>
    </div>
  );
}

/** A figure's meaning: the person's own words first, with every earlier version; what the sources fix about it on a button. */
export default function FigureMeanings({ figureId }: { figureId: string }) {
  const f = getFigure(figureId);
  if (!f) return null;
  return (
    <MeaningsPanel
      cardId={f.id}
      orientation="upright"
      api={`/api/geomancy/meanings/${encodeURIComponent(f.id)}`}
      stockLabel="What the sources fix"
      stockSection={<TraditionalText figure={f} />}
      noun="figure"
    />
  );
}
