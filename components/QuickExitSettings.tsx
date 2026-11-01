"use client";

import { useEffect, useState } from "react";
import { FEATHERED } from "@/lib/edition";
import { EXIT_TRIGGERS_CHANGED, askForMotion } from "@/components/QuickExitTriggers";
import {
  EXIT_TRIGGERS_KEY,
  QUICK_EXIT_TARGET_KEY,
  SNAKE_LOOK_KEY,
  exitTriggers,
  quickExitTarget,
  snakeLook,
  type ExitAction,
  type ExitTrigger,
  type ExitTriggers,
  type QuickExitTarget,
  type SnakeLook,
} from "@/lib/quick-exit-core";

// The quick exit's two choices, kept on this device only (docs/plan-feathered-edition.md 4.5): what the snake game's snake eats, and, on Winged,
// whether the quick exit goes to the game or to a weather search. Feathered never goes online, so it offers the game only. And the ways to set it off
// (components/QuickExitTriggers.tsx), each off, locking, or (for the administrator of a copy on their own computer) stopping the app.

const choiceClass = (on: boolean) =>
  `text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
    on ? "bg-tone-700/30 border-tone-600 text-tone-200" : "border-line-strong text-ink-muted hover:border-line-hover hover:text-ink-strong"
  }`;

const WAYS: { name: ExitTrigger; label: string; desc: string }[] = [
  { name: "keys", label: "Esc pressed twice", desc: "On a keyboard, press Esc twice within a second." },
  { name: "tap", label: "Two fingers tapped twice", desc: "On a touch screen, tap with two fingers together, twice, quickly." },
  {
    name: "shake",
    label: "A hard shake",
    desc: "Shake the phone or tablet hard, four times. An iPhone asks once whether this page may read its motion.",
  },
  {
    name: "leave",
    label: "Leaving the page",
    desc: "Going to another app or tab, or pressing a phone's home or power button. Phones do not let a web page use their buttons directly, but this is what those buttons do to the page. Choosing a photo or a file does not count.",
  },
];

const actionClass = (on: boolean) =>
  `min-h-11 px-3 py-1.5 rounded-control border text-sm transition-colors ${
    on ? "bg-tone-700/30 border-tone-600 text-tone-200" : "border-line-strong text-ink-muted hover:border-line-hover hover:text-ink-strong"
  }`;

function keep(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A browser that keeps nothing uses the defaults.
  }
}

export default function QuickExitSettings({ canStop }: { canStop: boolean }) {
  const [target, setTarget] = useState<QuickExitTarget>("snake");
  const [look, setLook] = useState<SnakeLook>("hekate");
  const [ways, setWays] = useState<ExitTriggers>(() => exitTriggers(null, false));
  const [noMotion, setNoMotion] = useState(false);

  useEffect(() => {
    try {
      setTarget(quickExitTarget(window.localStorage.getItem(QUICK_EXIT_TARGET_KEY), FEATHERED));
      setLook(snakeLook(window.localStorage.getItem(SNAKE_LOOK_KEY)));
      setWays(exitTriggers(window.localStorage.getItem(EXIT_TRIGGERS_KEY), canStop));
    } catch {
      // Defaults stand.
    }
    setNoMotion(typeof DeviceMotionEvent === "undefined" || !window.isSecureContext);
  }, [canStop]);

  function changeWays(next: ExitTriggers) {
    setWays(next);
    keep(EXIT_TRIGGERS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EXIT_TRIGGERS_CHANGED));
  }

  async function setWay(name: ExitTrigger, action: ExitAction) {
    // An iPhone asks for motion readings only from a press like this one.
    if (name === "shake" && action !== "off" && !(await askForMotion())) setNoMotion(true);
    changeWays({ ...ways, [name]: action });
  }

  const actions: { value: ExitAction; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "pause", label: "Lock" },
    ...(canStop ? [{ value: "stop" as const, label: FEATHERED ? "Stop and remove the drive" : "Stop the app" }] : []),
  ];

  return (
    <div className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-ink-strong">Quick hide</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          The Hide button at the top, or Esc pressed twice, signs you out at once and locks. Below are more ways to do it. These choices are kept on
          this device only.
        </p>
      </div>

      {!FEATHERED && (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">Where it goes</p>
          <div className="flex flex-col gap-2" role="group" aria-label="Where the quick hide goes">
            {([
              { value: "snake", label: "A snake game", desc: "The tab becomes a small snake game. Every page shows the game until you type your password as a high-score name." },
              { value: "weather", label: "A weather search", desc: "The tab goes to a weather search on the internet. You sign in again as usual." },
            ] as const).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTarget(value);
                  keep(QUICK_EXIT_TARGET_KEY, value);
                }}
                aria-pressed={target === value}
                className={choiceClass(target === value)}
              >
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-ink-muted mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {FEATHERED && (
        <p className="text-sm text-ink-muted leading-relaxed">
          The tab becomes a small snake game, and every page shows the game until you type your password as a high-score name. Any other name just
          goes on the table.
        </p>
      )}

      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Ways to set it off</p>
        <p className="text-xs text-ink-faint">
          Lock is the quick hide: the tab changes and you sign in again to come back.
          {canStop &&
            (FEATHERED
              ? " Stop and remove the drive also saves your data and stops the app, so the drive can be taken out. It works only on the computer the app runs on."
              : " Stop the app also saves your data and stops the app. It works only on the computer the app runs on.")}
        </p>
        {WAYS.map(({ name, label, desc }) => (
          <div key={name} className="space-y-1.5">
            <p className="text-sm font-medium text-ink-strong" id={`quick-exit-way-${name}`}>{label}</p>
            <p className="text-xs text-ink-muted">{desc}</p>
            {name === "shake" && noMotion && ways.shake !== "off" && (
              <p className="text-xs text-warning-ink">This browser does not give this page motion readings, so a shake does nothing here.</p>
            )}
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`quick-exit-way-${name}`}>
              {actions.map(({ value, label: actionLabel }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void setWay(name, value)}
                  aria-pressed={ways[name] === value}
                  className={actionClass(ways[name] === value)}
                >
                  {actionLabel}
                </button>
              ))}
            </div>
          </div>
        ))}
        <label className="flex items-start gap-3 text-sm text-ink-soft min-h-11">
          <input
            type="checkbox"
            className="mt-1 accent-tone-500"
            checked={ways.buzz}
            onChange={(e) => changeWays({ ...ways, buzz: e.target.checked })}
          />
          <span>
            Buzz once when it starts
            <span className="block text-xs text-ink-muted mt-0.5">
              On phones that allow it (most Android phones; iPhones do not), after the Exit button, a tap or a key press. A shake or leaving the page
              cannot buzz.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-ink-soft">What the snake eats</p>
        <div className="flex flex-col gap-2" role="group" aria-label="What the snake eats">
          {([
            { value: "hekate", label: "Little keys and flames", desc: "Hekate's key and torch, drawn very small." },
            { value: "plain", label: "Apples and berries", desc: "For a game with no hint of the app at all." },
          ] as const).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setLook(value);
                keep(SNAKE_LOOK_KEY, value);
              }}
              aria-pressed={look === value}
              className={choiceClass(look === value)}
            >
              <span className="font-medium">{label}</span>
              <span className="block text-xs text-ink-muted mt-0.5">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
