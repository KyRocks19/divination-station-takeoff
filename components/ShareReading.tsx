"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { getCardById } from "@/lib/cards";
import { MAX_PICTURE_CARDS, PICTURE_DEFAULTS, pictureFileName, planSpreadPicture, type PictureReading } from "@/lib/spread-picture-core";
import { canvasToPng, drawSpreadPicture } from "@/lib/spread-picture-draw";
import {
  NOTHING_EXTRA,
  readingToMarkdown,
  toolReadingToMarkdown,
  type ShareChoices,
  type ShareEntry,
  type ShareReading as ShareReadingData,
  type ShareToolReading as ShareToolReadingData,
} from "@/lib/share-reading-core";

type Entry = ShareEntry & { when: string };

const preview = (s: string) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > 60 ? `${one.slice(0, 60)}…` : one;
};

interface PanelProps {
  /** What the text holds before anything is ticked, in a sentence ("the title, the spread and the cards"). */
  always: string;
  /** What a reading is called in the panel: "reading", "draw". */
  noun: string;
  hasQuestion: boolean;
  /** Tarot readings have notes of their own; the others do not. */
  hasNotes: boolean;
  entries: Entry[];
  make: (choices: ShareChoices) => string;
}

/**
 * The panel itself: the ticks, the text and the Copy button. The text is made here, in the browser, from what the page already holds; nothing is
 * sent anywhere. Only what is always in it (`always`) is there until the person ticks something else.
 */
function SharePanel({ always, noun, hasQuestion, hasNotes, entries, make }: PanelProps) {
  const uid = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [question, setQuestion] = useState(NOTHING_EXTRA.question);
  const [date, setDate] = useState(NOTHING_EXTRA.date);
  const [notes, setNotes] = useState(NOTHING_EXTRA.notes);
  const [entryIds, setEntryIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");

  const text = useMemo(() => make({ question, date, notes, entryIds }), [make, question, date, notes, entryIds]);

  function toggleEntry(id: number) {
    setEntryIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setMessage("");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied.");
    } catch {
      // Some browsers refuse without permission: select the text so the person can copy it by hand.
      box.current?.focus();
      box.current?.select();
      setMessage("Your browser did not allow copying here. The text is selected: press Ctrl+C (Command+C on a Mac).");
    }
  }

  const check = "accent-tone-500 mt-1";
  return (
    <Card pad="sm">
      <details>
        <summary className="cursor-pointer text-xs text-ink-faint uppercase tracking-widest">Share this {noun} as text</summary>
        <div className="space-y-3 mt-3">
          <p className="text-xs text-ink-faint">
            This makes a text version of the {noun} that you can paste anywhere, such as a forum or a message. The text is made in your browser and
            nothing is sent from this app. It holds {always}. Your question{hasNotes ? ", notes" : ""} and journal entries are left out unless you tick them.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-xs text-ink-faint mb-1">Also include</legend>
            {hasQuestion && (
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" className={check} checked={question} onChange={(e) => { setQuestion(e.target.checked); setMessage(""); }} />
                <span>My question</span>
              </label>
            )}
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" className={check} checked={date} onChange={(e) => { setDate(e.target.checked); setMessage(""); }} />
              <span>The date</span>
            </label>
            {hasNotes && (
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" className={check} checked={notes} onChange={(e) => { setNotes(e.target.checked); setMessage(""); }} />
                <span>The reading notes</span>
              </label>
            )}
            {entries.map((e) => (
              <label key={e.id} className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" className={check} checked={entryIds.includes(e.id)} onChange={() => toggleEntry(e.id)} />
                <span>
                  Journal entry by {e.label}, {e.when}: <span className="text-ink-faint">{preview(e.content)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor={`${uid}-text`} className="block text-xs text-ink-faint mb-1">Text to copy</label>
            <Textarea id={`${uid}-text`} ref={box} readOnly value={text} rows={10} className="font-mono text-xs" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={copy}>Copy the text</Button>
            <span role="status" className="text-xs text-ink-muted">{message}</span>
          </div>
        </div>
      </details>
    </Card>
  );
}

/** The reading as the picture's plan wants it. Only these fields are copied: the notes and the journal never go near the picture. */
function toPictureReading(r: ShareReadingData): PictureReading {
  return {
    title: r.title,
    spread_name: r.spread_name,
    question: r.question,
    created_at: r.created_at,
    cards: r.cards.map((c) => ({
      position: c.position,
      card_name: c.card_name,
      reversed: c.reversed,
      file: (c.card_id && getCardById(c.card_id)?.fileName) || null,
      color: c.color ?? null,
      x: c.x ?? null,
      y: c.y ?? null,
      rotation: c.rotation ?? null,
    })),
    clarifiers: Object.fromEntries(Object.entries(r.clarifiers).map(([i, list]) => [i, list.map((c) => ({ card_name: c.card_name, reversed: c.reversed }))])),
  };
}

/**
 * The spread as a picture to save or share. The picture is painted here, in the browser, from the cards already on the page; nothing is sent anywhere.
 * It holds the title, the spread and the cards, and the question and date only if ticked. Notes and journal entries are never in it.
 */
function SharePicture({ reading }: { reading: ShareReadingData }) {
  const uid = useId();
  const shown = useRef<HTMLCanvasElement>(null);
  const made = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(PICTURE_DEFAULTS.question);
  const [date, setDate] = useState(PICTURE_DEFAULTS.date);
  const [art, setArt] = useState(PICTURE_DEFAULTS.art);
  const [state, setState] = useState<"idle" | "drawing" | "ready" | "failed">("idle");
  const [canShare, setCanShare] = useState(false);
  const [message, setMessage] = useState("");

  const plan = useMemo(() => planSpreadPicture(toPictureReading(reading), { question, date, art }), [reading, question, date, art]);

  useEffect(() => {
    try {
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [new File(["x"], "spread.png", { type: "image/png" })] }));
    } catch {
      setCanShare(false);
    }
  }, []);

  // Paint on a canvas of its own, then copy it to the one on the page, so two quick changes cannot paint over each other.
  useEffect(() => {
    if (!open || !plan || !shown.current) return;
    let cancelled = false;
    setState("drawing");
    const off = document.createElement("canvas");
    drawSpreadPicture(plan, off)
      .then(() => {
        const target = shown.current;
        if (cancelled || !target) return;
        target.width = off.width;
        target.height = off.height;
        target.getContext("2d")?.drawImage(off, 0, 0);
        made.current = off;
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [open, plan]);

  const fileName = pictureFileName(reading.title, reading.spread_name);

  async function download() {
    const blob = made.current ? await canvasToPng(made.current) : null;
    if (!blob) {
      setMessage("Your browser could not make the picture file. Try again, or press and hold the picture to save it.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setMessage("The picture was saved to your downloads.");
  }

  async function share() {
    const blob = made.current ? await canvasToPng(made.current) : null;
    if (!blob) {
      setMessage("Your browser could not make the picture file.");
      return;
    }
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title: reading.title || reading.spread_name });
      setMessage("");
    } catch (err) {
      // Closing the share sheet is not a failure.
      if ((err as { name?: string })?.name !== "AbortError") setMessage("Your device did not share the picture. Use “Download the picture” instead.");
    }
  }

  async function copyDescription() {
    try {
      await navigator.clipboard.writeText(plan?.description ?? "");
      setMessage("The description was copied.");
    } catch {
      setMessage("Your browser did not allow copying here. The description is written below the picture: select it by hand.");
    }
  }

  const check = "accent-tone-500 mt-1";
  return (
    <Card pad="sm">
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer text-xs text-ink-faint uppercase tracking-widest">Share this spread as a picture</summary>
        <div className="space-y-3 mt-3">
          <p className="text-xs text-ink-faint">
            This makes a picture of the spread that you can save or post. It is made in your browser and nothing is sent from this app. It holds the title, the spread and the
            cards. Your question and the date are left out unless you tick them, and your notes and journal entries are never in it.
          </p>
          {!plan ? (
            <p className="text-sm text-ink-muted">
              {reading.cards.length === 0 ? "This reading has no cards to draw." : `A picture is made for up to ${MAX_PICTURE_CARDS} cards. Use the text version for this reading.`}
            </p>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs text-ink-faint mb-1">Show in the picture</legend>
                {(reading.question ?? "").trim() !== "" && (
                  <label className="flex items-start gap-2 text-sm text-ink-soft">
                    <input type="checkbox" className={check} checked={question} onChange={(e) => { setQuestion(e.target.checked); setMessage(""); }} />
                    <span>My question</span>
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" className={check} checked={date} onChange={(e) => { setDate(e.target.checked); setMessage(""); }} />
                  <span>The date</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" className={check} checked={art} onChange={(e) => { setArt(e.target.checked); setMessage(""); }} />
                  <span>The pictures on the cards (off, each card is a plain box with its name)</span>
                </label>
              </fieldset>
              <canvas ref={shown} role="img" aria-label={plan.description} className="block w-full max-w-md h-auto rounded-card border border-line bg-surface-sunken" />
              {state === "failed" && <p role="alert" className="text-xs text-danger">The picture could not be made in this browser. The text version above still works.</p>}
              <div>
                <p className="block text-xs text-ink-faint mb-1" id={`${uid}-desc-label`}>Description of the picture, for the alt text of a post</p>
                <p aria-labelledby={`${uid}-desc-label`} className="text-xs text-ink-muted break-words">{plan.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={download} disabled={state !== "ready"}>Download the picture</Button>
                {canShare && <Button variant="quiet" onClick={share} disabled={state !== "ready"}>Share the picture…</Button>}
                <Button variant="quiet" onClick={copyDescription}>Copy the description</Button>
                <span role="status" className="text-xs text-ink-muted">{message || (state === "drawing" ? "Making the picture…" : "")}</span>
              </div>
            </>
          )}
        </div>
      </details>
    </Card>
  );
}

/** A tarot reading as text to copy, and as a picture to save or share. */
export default function ShareReading({ reading, entries }: { reading: ShareReadingData; entries: Entry[] }) {
  const make = useMemo(() => (c: ShareChoices) => readingToMarkdown(reading, entries, c), [reading, entries]);
  return (
    <>
      <SharePanel
        always="the title, the spread and the cards"
        noun="reading"
        hasQuestion={!!(reading.question ?? "").trim()}
        hasNotes={!!(reading.notes ?? "").trim()}
        entries={entries}
        make={make}
      />
      <SharePicture reading={reading} />
    </>
  );
}

/** A reading with any other tool as text to copy: what came up (always in it), and the question, date and entries only if ticked. */
export function ShareToolReading({ reading, entries }: { reading: ShareToolReadingData; entries: Entry[] }) {
  const make = useMemo(() => (c: ShareChoices) => toolReadingToMarkdown(reading, entries, c), [reading, entries]);
  return <SharePanel always={`what came up with ${reading.tool}`} noun="reading" hasQuestion={!!(reading.question ?? "").trim()} hasNotes={false} entries={entries} make={make} />;
}
