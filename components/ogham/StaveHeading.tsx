"use client";

import { useState } from "react";
import { staveTitle } from "@/lib/stave-names-core";
import StaveGlyph from "@/components/ogham/StaveGlyph";
import StaveNameEditor from "@/components/ogham/StaveNameEditor";

interface Props {
  staveId: string;
  /** The person's own name for the stave, or null. */
  initialName: string | null;
}

/** A stave page's heading: the person's own name for the stave when they have one, otherwise its medieval name. */
export default function StaveHeading({ staveId, initialName }: Props) {
  const [own, setOwn] = useState(initialName);
  const title = staveTitle(staveId, own, false);
  return (
    <header className="space-y-3">
      <div className="flex items-center gap-5">
        <StaveGlyph staveId={staveId} className="w-14 h-24 flex-shrink-0 text-tone-200" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-tone-100 break-words">{title.name}</h1>
          {title.medieval && <p className="text-sm text-ink-muted break-words">Medieval name: {title.medieval}</p>}
        </div>
      </div>
      <StaveNameEditor staveId={staveId} name={own} onSaved={setOwn} />
    </header>
  );
}
