"use client";

import { useEffect, useId, useState } from "react";

/** The speeds a person can choose, from the slowest to the fastest. 1 is the usual speed. */
export const PENDULUM_SPEEDS = [
  { id: "slowest", label: "Much slower", value: 0.25 },
  { id: "slow", label: "Slower", value: 0.5 },
  { id: "usual", label: "Usual", value: 1 },
  { id: "fast", label: "Faster", value: 2 },
] as const;

type SpeedId = (typeof PENDULUM_SPEEDS)[number]["id"];

const KEY = "ds-pendulum-speed";

/**
 * The speed the person chose for the swinging weight, kept on this device (like Reading comfort). It starts at the
 * usual speed on the first draw and takes the saved choice straight after, so the page is the same on the server
 * and in the browser. Storage that is blocked just means the choice is not remembered.
 */
export function usePendulumSpeed(): [SpeedId, (id: SpeedId) => void, number] {
  const [id, setId] = useState<SpeedId>("usual");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (PENDULUM_SPEEDS.some((s) => s.id === saved)) setId(saved as SpeedId);
    } catch {
      /* storage blocked: the usual speed stays */
    }
  }, []);
  function choose(next: SpeedId) {
    setId(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* not remembered */
    }
  }
  return [id, choose, PENDULUM_SPEEDS.find((s) => s.id === id)!.value];
}

/** Four choices for how fast the weight moves. Shown beside the swing; kept on this device only, and the screen says so (Y5, decided 2026-10-18). */
export default function PendulumSpeed({ value, onChange }: { value: SpeedId; onChange: (id: SpeedId) => void }) {
  const uid = useId();
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="text-xs text-ink-faint mb-1">How fast it moves</legend>
      <div className="flex flex-wrap justify-center gap-2">
        {PENDULUM_SPEEDS.map((s) => (
          <label
            key={s.id}
            className={`text-xs px-3 py-1.5 min-h-11 sm:min-h-0 flex items-center gap-2 rounded-lg border cursor-pointer transition-colors ${
              value === s.id ? "border-focus text-ink-strong bg-surface-sunken" : "border-line-strong text-ink-muted hover:border-line-hover"
            }`}
          >
            <input
              type="radio"
              name={`${uid}-speed`}
              value={s.id}
              checked={value === s.id}
              onChange={() => onChange(s.id)}
              className="accent-tone-600"
            />
            {s.label}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-ink-ghost mt-1">
        Kept only in this browser on this device, not in your account: another phone or computer starts at the usual speed. It changes only how the
        picture moves.
      </p>
    </fieldset>
  );
}
