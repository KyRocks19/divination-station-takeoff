"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { DIVINATION_KINDS, DIVINATION_KIND_START, type DivinationKind } from "@/lib/divination-kinds";

/** The large pink "+ New Reading", for the top of the Days page and of today's page (owner's request, 2026-10-30: in place of a row of tool pills). */
export const newReadingBigClass =
  "inline-flex items-center gap-2 bg-blush hover:bg-blush-soft text-canvas text-base font-semibold px-6 py-3 min-h-12 rounded-card shadow-md transition-colors";

interface Props {
  tools: DivinationKind[] | null;
  /** The button's look, when it should not be the page's main pink button (the header bar draws it in its own colours). */
  className?: string;
  /** Opens the list in the flow of the page instead of floating, for a scrolling column (the phone menu) that would cut it off. */
  inline?: boolean;
}

/**
 * The "+ New Reading" button. With one tool chosen it goes straight to that tool; with several (or all) it opens a
 * short list of ways to begin. Tarot is first in the list because the button always began a tarot reading before.
 */
export default function NewReadingMenu({ tools, className, inline = false }: Props) {
  const kinds = tools ?? DIVINATION_KINDS;
  const uid = useId();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // When the list closes and focus was lost with it (Escape, or a pick that stays on the page), put focus back on the
  // button. An outside press keeps whatever the person pressed instead.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const here = document.activeElement;
    if (!here || here === document.body) trigger.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Used here, so it is not one press of the quick exit's Esc Esc (components/QuickExitTriggers.tsx).
        e.preventDefault();
        trigger.current?.focus();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const button = className ?? buttonClass.primary;

  if (kinds.length === 1) {
    const start = DIVINATION_KIND_START[kinds[0]];
    return (
      <Link href={start.href} aria-label={`Start a new reading: ${start.label}`} className={button}>
        + New Reading
      </Link>
    );
  }

  return (
    <div ref={box} className={inline ? undefined : "relative"}>
      <button
        ref={trigger}
        type="button"
        className={button}
        aria-expanded={open}
        aria-controls={uid}
        onClick={() => setOpen((o) => !o)}
      >
        + New Reading
      </button>
      {open && (
        <ul
          id={uid}
          data-popup-open
          className={`${inline ? "" : "absolute right-0 z-20 w-60 shadow-lg "}mt-2 bg-surface border border-line-strong rounded-card p-1`}
        >
          {kinds.map((kind) => (
            <li key={kind}>
              <Link
                href={DIVINATION_KIND_START[kind].href}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink hover:bg-surface-sunken rounded-lg"
              >
                {DIVINATION_KIND_START[kind].label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
