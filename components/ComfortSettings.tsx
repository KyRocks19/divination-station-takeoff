"use client";

import { useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DEFAULT_COMFORT, FONT_CHOICES, LAYOUT_FIELDS, SIZE_CHOICES, type Comfort } from "@/lib/comfort";
import { styleRef } from "@/lib/apply-style";
import { useComfort } from "@/components/useComfort";

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

/** The comfort choices without the layout ones, to tell whether "Back to standard" has anything to do. */
function readingPart(c: Comfort): Partial<Comfort> {
  const out: Partial<Comfort> = { ...c };
  for (const f of LAYOUT_FIELDS) delete out[f];
  return out;
}

/**
 * "Reading comfort": font, text size, spacing and motion. The choices apply at once and are put on the page before it is drawn
 * (app/layout.tsx). They are kept in the person's account (open item T15a, migration 079), so they follow them to other devices,
 * and a copy is kept in this browser as well so the sign-in page, which has no account to read, looks the same. A person who set
 * choices on this device before the account could keep them stays device-only until they press "Keep these in my account", and
 * anyone can go back to "this device only". The layout choices kept in the same record are in LayoutSettings, below; both
 * cards share one copy of the choices (components/useComfort.ts).
 */
export default function ComfortSettings() {
  const uid = useId();
  const { comfort, mode, storable, change, chooseMode } = useComfort();
  const [note, setNote] = useState("");

  async function pick(patch: Partial<Comfort>) {
    setNote(await change(patch));
  }

  const isStandard = JSON.stringify(readingPart(comfort)) === JSON.stringify(readingPart(DEFAULT_COMFORT));

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
              onChange={() => pick({ font: f.id })}
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
            <Choice key={s.id} name={`${uid}-size`} value={String(s.id)} checked={comfort.size === s.id} onChange={() => pick({ size: s.id })}>
              {s.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Spacing</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-spacing`} value="normal" checked={comfort.spacing === "normal"} onChange={() => pick({ spacing: "normal" })}>
            Standard
          </Choice>
          <Choice name={`${uid}-spacing`} value="roomy" checked={comfort.spacing === "roomy"} onChange={() => pick({ spacing: "roomy" })}>
            Roomy: more space between lines, letters and words
          </Choice>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Motion</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-motion`} value="system" checked={comfort.motion === "system"} onChange={() => pick({ motion: "system" })}>
            Follow my device&apos;s setting
          </Choice>
          <Choice name={`${uid}-motion`} value="less" checked={comfort.motion === "less"} onChange={() => pick({ motion: "less" })}>
            Less motion: nothing slides, pulses or buzzes
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
        <Button variant="quiet" disabled={isStandard} onClick={() => pick(readingPart(DEFAULT_COMFORT))}>
          Back to standard
        </Button>
        {mode === "device" && (
          <Button variant="quiet" onClick={async () => setNote(await chooseMode("account"))}>
            Keep these in my account
          </Button>
        )}
        {mode === "account" && (
          <Button variant="quiet" onClick={async () => setNote(await chooseMode("device"))}>
            Keep them on this device only
          </Button>
        )}
        <p role="status" className="text-xs text-success-ink">{note}</p>
      </div>
      {!storable && <NotStorable />}
    </Card>
  );
}

function NotStorable() {
  return (
    <p role="alert" className="text-xs text-danger-ink">
      This browser is not letting the app save your choices (a private window can do that). They apply until you leave
      this page.
    </p>
  );
}

/**
 * "Layout": whether the header bar stays at the top, and whether the full side menu lies over the page or pushes it over.
 * Kept with the reading-comfort choices, in the account or on this device as that card says.
 */
export function LayoutSettings() {
  const uid = useId();
  const { comfort, mode, storable, change } = useComfort();
  const [note, setNote] = useState("");

  async function pick(patch: Partial<Comfort>) {
    setNote(await change(patch));
  }

  return (
    <Card className="space-y-5" role="group" aria-labelledby={`${uid}-h`}>
      <div>
        <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Layout</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          Where the header bar and the side menu sit. Each choice applies as soon as you pick it.{" "}
          {mode === "account"
            ? "They are kept in your account with your reading comfort choices."
            : "Right now they are kept only in this browser, like your reading comfort choices."}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Header bar</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-header`} value="sticky" checked={comfort.header === "sticky"} onChange={() => pick({ header: "sticky" })}>
            Stays at the top while I scroll
          </Choice>
          <Choice name={`${uid}-header`} value="scrolls" checked={comfort.header === "scrolls"} onChange={() => pick({ header: "scrolls" })}>
            Scrolls away with the page
          </Choice>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-strong mb-1">Side menu</legend>
        <p className="text-xs text-ink-faint">
          On a wide screen, when the side menu is open in full. Narrowed to its pictures, it always sits beside the page, and on a
          small screen it opens as a drawer.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Choice name={`${uid}-sidebar`} value="overlay" checked={comfort.sidebar === "overlay"} onChange={() => pick({ sidebar: "overlay" })}>
            Lies over the edge of the page
          </Choice>
          <Choice name={`${uid}-sidebar`} value="push" checked={comfort.sidebar === "push"} onChange={() => pick({ sidebar: "push" })}>
            Pushes the page over to make room
          </Choice>
        </div>
      </fieldset>

      <p role="status" className="text-xs text-success-ink">{note}</p>
      {!storable && <NotStorable />}
    </Card>
  );
}
