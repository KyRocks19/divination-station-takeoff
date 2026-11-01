"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import FeedbackForm from "@/components/FeedbackForm";
import { Dialog } from "@/components/ui/Dialog";

const OpenFeedback = createContext<() => void>(() => {});

/**
 * The feedback window, drawn once for the whole app. "Send feedback" in the navigation opens it over the page the person
 * is on, so a problem can be reported at the moment it happens without leaving that page (the form can note which page
 * it was). It replaced a floating button that covered the corner of every page and was the last stop of the Tab order.
 * When it closes, the browser puts focus back on the button that opened it.
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const openFeedback = useCallback(() => {
    setFormKey((k) => k + 1);
    setOpen(true);
  }, []);

  return (
    <OpenFeedback.Provider value={openFeedback}>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="feedback-title">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="feedback-title" className="text-base font-semibold text-ink-strong">Send feedback</h2>
          <Link href="/feedback" onClick={() => setOpen(false)} className="inline-flex items-center min-h-11 sm:min-h-0 text-xs text-accent-ink hover:text-accent-ink-hover">What I have sent</Link>
        </div>
        {open && <FeedbackForm key={formKey} onCancel={() => setOpen(false)} />}
      </Dialog>
    </OpenFeedback.Provider>
  );
}

/** Opens the feedback window. Outside a FeedbackProvider it does nothing. */
export function useOpenFeedback(): () => void {
  return useContext(OpenFeedback);
}
