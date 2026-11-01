"use client";

import { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  /** Called when the person closes it: Escape, a click on the dimmed page around it, or the page asking it to close. */
  onClose: () => void;
  /** The id of the dialog's heading. */
  labelledBy: string;
  /** Width and placement, when the default (centred, up to 32rem) does not fit. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A modal window over the page: a native `<dialog>` opened with `showModal`, so the page behind cannot be reached, Escape closes it
 * and the browser puts focus back where it was. A click on the dimmed page around it closes it too. The look is the feedback
 * window's (`bg-surface`, `border-line-strong`, `rounded-card`). Put a heading inside with the id given as `labelledBy`.
 */
export function Dialog({ open, onClose, labelledBy, className = "m-auto w-[min(32rem,calc(100vw-2rem))]", children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`${className} rounded-card border border-line-strong bg-surface p-5 text-ink backdrop:bg-black/50`}
    >
      {children}
    </dialog>
  );
}
