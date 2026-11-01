"use client";

import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  COMFORT_ATTRIBUTES,
  COMFORT_KEY,
  DEFAULT_COMFORT,
  FONT_CHOICES,
  SIZE_CHOICES,
  comfortAttributes,
  parseComfort,
  type Comfort,
} from "@/lib/comfort";
import { styleRef } from "@/lib/apply-style";

/** Puts the choices on <html> now, the same attributes the head script sets before the first paint. */
function applyToPage(c: Comfort) {
  const root = document.documentElement;
  for (const a of COMFORT_ATTRIBUTES) root.removeAttribute(a);
  for (const [k, v] of Object.entries(comfortAttributes(c))) root.setAttribute(k, v);
}

const optionClass =
  "flex items-start gap-3 rounded-control border border-line px-3 py-2.5 min-h-11 cursor-pointer text-sm text-ink " +
  "hover:border-line-hover has-[:checked]:border-line-accent has-[:checked]:bg-tone-900/40 has-[:checked]:ring-2 has-[:checked]:ring-focus";

const radioClass = "accent-[var(--color-focus)]";

interface ChoiceProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}

/** One round choice in a row of them, with its label as the clickable area. */
function Choice({ name, value, checked, onChange, children }: ChoiceProps) {
  return (
    <label className={`${optionClass} items-center`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className={radioClass} />
      <span>{children}</span>
    </label>
  );
}

/**
 * "Reading comfort": font, text size, spacing and motion. The choices apply at once and are put on the page before it is drawn
 * (app/layout.tsx). They are kept in the person's account (open item T15a, migration 079), so they follow them to other devices,
 * and a copy is kept in this browser as well so the sign-in page, which has no account to read, looks the same. A person who set
 * choices on this device before the account could keep them stays device-only until they press "Keep these in my account", and
 * anyone can go back to "this device only". The first render is always the standard one and what is saved is read after it,
 * so nothing depends on the browser at first paint.
 */
export default function ComfortSettings() {
  const uid = useId();
  const [comfort, setComfort] = useState<Comfort>(DEFAULT_COMFORT);
  const [note, setNote] = useState("");
  const [storable, setStorable] = useState(true);
  // "account": every change is also saved in the account. "device": only in this browser.
  const [mode, setMode] = useState<"account" | "device">("account");

  useEffect(() => {
    let device: Comfort = DEFAULT_COMFORT;
    try {
      device = parseComfort(localStorage.getItem(COMFORT_KEY));
    } catch {
      setStorable(false);
    }
    const ctrl = new AbortController();
    fetch("/api/comfort", { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ comfort: Comfort | null }>) : null))
      .then((data) => {
        if (data?.comfort) {
          // The account has choices: they win, and the page was drawn with them already.
          setComfort(data.comfort);
          setMode("account");
        } else {
          setComfort(device);
          // Someone who chose things on this device before stays device-only until they decide.
          setMode(JSON.stringify(device) === JSON.stringify(DEFAULT_COMFORT) ? "account" : "device");
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setComfort(device);
      });
    return () => ctrl.abort();
  }, []);

  function keepOnDevice(next: Comfort): boolean {
    try {
      if (Object.keys(comfortAttributes(next)).length === 0) localStorage.removeItem(COMFORT_KEY);
      else localStorage.setItem(COMFORT_KEY, JSON.stringify(next));
      setStorable(true);
      return true;
    } catch {
      setStorable(false);
      return false;
    }
  }

  /** Saves in the account too, when the mode says so. Returns the line to show. */
  async function keepInAccount(next: Comfort): Promise<string> {
    const res = await fetch("/api/comfort", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comfort: next }),
    }).catch(() => null);
    return res?.ok
      ? "Saved in your account. It applies to every page, on every device you sign in on."
      : "Saved on this device. It could not be saved in your account just now; try again in a moment.";
  }

  async function change(next: Comfort) {
    setComfort(next);
    applyToPage(next);
    const onDevice = keepOnDevice(next);
    if (mode === "account") setNote(await keepInAccount(next));
    else setNote(onDevice ? "Saved on this device. It applies to every page here." : "");
  }

  async function chooseMode(to: "account" | "device") {
    setMode(to);
    if (to === "account") {
      setNote(await keepInAccount(comfort));
      return;
    }
    const res = await fetch("/api/comfort", { method: "DELETE" }).catch(() => null);
    setNote(res?.ok ? "Kept on this device only. Other devices are not changed." : "That did not work just now; try again in a moment.");
  }

  const isStandard = JSON.stringify(comfort) === JSON.stringify(DEFAULT_COMFORT);

  return (
    <Card className="space-y-5" role="group" aria-labelledby={`${uid}-h`}>
      <div>
        <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Reading comfort</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          Make the words easier on your eyes and your attention. Each choice applies as soon as you pick it.{" "}
          {mode === "account"
            ? "They are kept in your account, so they follow you to every device you sign in on."
            : "Right now they are kept only in this browser, so set them again on another device."}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Font</legend>
        {FONT_CHOICES.map((f) => (
          <label key={f.id} className={optionClass}>
            <input
              type="radio"
              name={`${uid}-font`}
              value={f.id}
              checked={comfort.font === f.id}
              onChange={() => change({ ...comfort, font: f.id })}
              className={`mt-1 ${radioClass}`}
            />
            <span>
              <span className="block font-medium" ref={styleRef({ fontFamily: f.family })}>{f.label}</span>
              <span className="block text-xs text-ink-faint mt-0.5">{f.note}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Text size</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SIZE_CHOICES.map((s) => (
            <Choice key={s.id} name={`${uid}-size`} value={String(s.id)} checked={comfort.size === s.id} onChange={() => change({ ...comfort, size: s.id })}>
              {s.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Spacing</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-spacing`} value="normal" checked={comfort.spacing === "normal"} onChange={() => change({ ...comfort, spacing: "normal" })}>
            Standard
          </Choice>
          <Choice name={`${uid}-spacing`} value="roomy" checked={comfort.spacing === "roomy"} onChange={() => change({ ...comfort, spacing: "roomy" })}>
            Roomy: more space between lines, letters and words
          </Choice>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Motion</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-motion`} value="system" checked={comfort.motion === "system"} onChange={() => change({ ...comfort, motion: "system" })}>
            Follow my device&apos;s setting
          </Choice>
          <Choice name={`${uid}-motion`} value="less" checked={comfort.motion === "less"} onChange={() => change({ ...comfort, motion: "less" })}>
            Less motion: nothing slides, pulses or buzzes
          </Choice>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Header bar</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-header`} value="sticky" checked={comfort.header === "sticky"} onChange={() => change({ ...comfort, header: "sticky" })}>
            Stays at the top while I scroll
          </Choice>
          <Choice name={`${uid}-header`} value="scrolls" checked={comfort.header === "scrolls"} onChange={() => change({ ...comfort, header: "scrolls" })}>
            Scrolls away with the page
          </Choice>
        </div>
      </fieldset>

      <div className="rounded-control border border-line px-4 py-3">
        <p className="text-xs uppercase tracking-widest text-ink-faint mb-1">How it reads</p>
        <p className="text-sm text-ink leading-relaxed">
          The Tower is not a card of doom. It is the moment a story you were holding stops holding you. Il1 O0: these
          letters should be easy to tell apart.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="quiet" disabled={isStandard} onClick={() => change(DEFAULT_COMFORT)}>
          Back to standard
        </Button>
        {mode === "device" && (
          <Button variant="quiet" onClick={() => chooseMode("account")}>
            Keep these in my account
          </Button>
        )}
        {mode === "account" && (
          <Button variant="quiet" onClick={() => chooseMode("device")}>
            Keep them on this device only
          </Button>
        )}
        <p role="status" className="text-xs text-success-ink">{note}</p>
      </div>
      {!storable && (
        <p role="alert" className="text-xs text-danger-ink">
          This browser is not letting the app save your choices (a private window can do that). They apply until you leave
          this page.
        </p>
      )}
    </Card>
  );
}
