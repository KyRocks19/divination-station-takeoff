"use client";

import { useEffect, useRef, useState } from "react";
import { MIN_MOTION_SAMPLES, motionWords, readMotion, type MotionPoint, type MotionReading } from "@/lib/pendulum-motion";
import { buttonClass } from "@/components/ui/Button";

/** Seconds to put the phone down flat before it listens, and seconds it listens for. */
const GET_READY_SECONDS = 3;
const LISTEN_SECONDS = 6;

interface Props {
  /** What the person typed as their question; it is saved with the answer. */
  question: string;
  hints: boolean;
  /** Called with the saved answer's id. */
  onSaved: (id: number) => void;
}

type Phase = "idle" | "asking-permission" | "get-ready" | "listening" | "result";

/** The part of a motion event this component reads. iOS asks permission through a static `requestPermission`. */
type MotionEventClass = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Lets a phone's own movement choose the swing instead of chance. The person puts the phone flat on their palm, screen up,
 * top edge pointing away, and moves it as they like for a few seconds. The movement is summed up on the phone as a line
 * at an angle, a circle either way, or still; only that summary is sent, never the sensor readings. The app then picks
 * the swing in play that matches, and the saved answer says it was chosen this way.
 */
export default function MotionAsk({ question, hints, onSaved }: Props) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [reading, setReading] = useState<MotionReading | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const samples = useRef<MotionPoint[]>([]);
  const timers = useRef<number[]>([]);
  const listener = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  // Whether the browser has motion events at all is only known in the browser, so it is checked after the first draw.
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "DeviceMotionEvent" in window);
    return stop;
  }, []);

  function stop() {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (listener.current) window.removeEventListener("devicemotion", listener.current);
    listener.current = null;
  }

  function reset() {
    stop();
    setPhase("idle");
    setReading(null);
    setError(null);
  }

  async function start() {
    setError(null);
    setReading(null);
    // iPhones and iPads ask first; the question has to be asked straight from the press of the button.
    const asker = (window as unknown as { DeviceMotionEvent: MotionEventClass }).DeviceMotionEvent;
    if (typeof asker.requestPermission === "function") {
      setPhase("asking-permission");
      try {
        if ((await asker.requestPermission()) !== "granted") {
          setPhase("idle");
          setError("Movement was not allowed on this device, so it cannot choose the swing. You can still let chance pick.");
          return;
        }
      } catch {
        setPhase("idle");
        setError("This device would not share its movement. You can still let chance pick.");
        return;
      }
    }

    samples.current = [];
    let listening = false;
    listener.current = (e) => {
      if (!listening) return;
      // The acceleration without gravity when the device gives it; otherwise with gravity, which the shape-finder levels out.
      const a = e.acceleration && e.acceleration.x !== null && e.acceleration.y !== null ? e.acceleration : e.accelerationIncludingGravity;
      if (a && a.x !== null && a.y !== null) samples.current.push({ x: a.x, y: a.y });
    };
    window.addEventListener("devicemotion", listener.current);

    setPhase("get-ready");
    setSeconds(GET_READY_SECONDS);
    let left = GET_READY_SECONDS;
    const countdown = window.setInterval(() => {
      left -= 1;
      setSeconds(Math.max(left, 0));
    }, 1000);
    timers.current.push(countdown);
    timers.current.push(
      window.setTimeout(() => {
        window.clearInterval(countdown);
        listening = true;
        setPhase("listening");
        setSeconds(LISTEN_SECONDS);
        let remaining = LISTEN_SECONDS;
        const tick = window.setInterval(() => {
          remaining -= 1;
          setSeconds(Math.max(remaining, 0));
        }, 1000);
        timers.current.push(tick);
        timers.current.push(
          window.setTimeout(() => {
            window.clearInterval(tick);
            listening = false;
            const found = readMotion(samples.current);
            const got = samples.current.length;
            stop();
            samples.current = [];
            if (!found) {
              setPhase("idle");
              setError(
                got === 0
                  ? "No movement came from this device. This works on a phone or tablet with motion sensors. You can still let chance pick."
                  : `Only ${got} readings came in, which is too few (at least ${MIN_MOTION_SAMPLES} are needed). Try again, or let chance pick.`
              );
              return;
            }
            setReading(found);
            setPhase("result");
          }, LISTEN_SECONDS * 1000)
        );
      }, GET_READY_SECONDS * 1000)
    );
  }

  async function ask() {
    if (!reading || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pendulum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          motion: { shape: reading.shape, angle: reading.angle },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "");
      }
      onSaved((await res.json()).id);
    } catch (err) {
      setError((err instanceof Error && err.message) || "Could not save the answer. Nothing was saved; your question is still here.");
      setSaving(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="border-t border-line-faint pt-4 space-y-3">
      <h2 className="text-[10px] text-ink-faint uppercase tracking-widest">Or use your phone&rsquo;s movement</h2>
      {hints && (
        <p className="text-xs text-ink-faint leading-relaxed">
          Instead of chance, your own movement can choose the swing. Lay the phone flat on your palm, screen up, top edge
          pointing away from you. When it starts listening, move your hand along a line, round in a circle, or hold it still,
          for {LISTEN_SECONDS} seconds. The phone sums the movement up as one of those shapes and the app picks the swing you
          have in play that matches. Only that shape is sent, never the readings, and the answer is saved as chosen by your movement.
        </p>
      )}

      {phase === "idle" && (
        <button type="button" onClick={start} className={buttonClass.purple}>
          Choose with my phone&rsquo;s movement
        </button>
      )}

      {phase === "asking-permission" && <p role="status" className="text-sm text-ink-muted">Waiting for your device to ask about movement…</p>}

      {(phase === "get-ready" || phase === "listening") && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-ink-strong">
            {phase === "get-ready"
              ? `Lay the phone flat on your palm. It starts listening in ${GET_READY_SECONDS} seconds.`
              : `Listening. Move your hand for ${LISTEN_SECONDS} seconds.`}
          </p>
          <p aria-hidden="true" className="text-3xl font-bold text-tone-100 tabular-nums">{seconds}</p>
          <button type="button" onClick={reset} className={buttonClass.quiet}>Cancel</button>
        </div>
      )}

      {phase === "result" && reading && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-ink-strong">
            Your phone moved in {motionWords(reading.shape, reading.angle)}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={ask} disabled={saving} className={buttonClass.primary}>
              {saving ? "Saving…" : "Ask with this"}
            </button>
            <button type="button" onClick={reset} disabled={saving} className={buttonClass.quiet}>Try again</button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
