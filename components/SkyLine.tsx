"use client";

import { useEffect, useState } from "react";
import { skyAt, type Sky } from "@/lib/sky";
import { PLANET_META } from "@/lib/card-associations";
import { usePrefs } from "./usePrefs";
import { styleRef } from "@/lib/apply-style";

interface Props {
  /** The sky stored with a reading. Leave out to show the sky right now. */
  sky?: Sky & { recorded?: boolean };
  className?: string;
}

/** One line describing the sky: moon phase, sun sign, planetary day, and place on the Wheel of the Year. */
export default function SkyLine({ sky, className = "" }: Props) {
  const prefs = usePrefs();
  const [now, setNow] = useState<Sky | null>(null);

  // "Right now" is worked out in the browser so the weekday and date are the user's own.
  useEffect(() => {
    if (sky) return;
    setNow(skyAt(new Date(), {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hemisphere: prefs.hemisphere,
    }));
  }, [sky, prefs.hemisphere]);

  const s = sky ?? now;
  if (!s) return null;

  const ruler = PLANET_META[s.dayRuler];
  const wheel = s.daysSincePrevious === 0
    ? s.wheelPrevious
    : `${s.daysSincePrevious} day${s.daysSincePrevious !== 1 ? "s" : ""} after ${s.wheelPrevious}, ${s.daysToNext} before ${s.wheelNext}`;

  return (
    <p
      className={`text-xs text-ink-faint flex flex-wrap gap-x-3 gap-y-0.5 ${className}`}
      title={sky && sky.recorded === false ? "Worked out from the reading's date; it was not recorded at the time." : undefined}
    >
      <span>
        <span aria-hidden="true">{s.moonSymbol} </span>
        {s.moonPhase} <span className="text-ink-ghost">· {s.illumination}% lit</span>
      </span>
      <span>Sun in {s.sunSign}</span>
      <span>
        {s.weekday}, day of {s.dayRuler === "Sun" || s.dayRuler === "Moon" ? "the " : ""}{s.dayRuler}
        {ruler && <span aria-hidden="true" ref={styleRef({ color: ruler.color })}> {ruler.symbol}</span>}
      </span>
      <span>{wheel}</span>
    </p>
  );
}
