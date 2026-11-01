"use client";

import { FEATHERED } from "@/lib/edition";
import { useState } from "react";
import { savePrefs, usePrefs } from "@/components/usePrefs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/Page";
import CompanionFocusForm from "@/components/CompanionFocusForm";
import { focusInvitationDue, focusOption, reachedMilestone } from "@/lib/companion-focus";

/**
 * The quiet invitation on the home page: once the person has made 10 readings (and again at 25, 50, ...) and has the companion switched on,
 * it offers to set what they want from it. It is never a requirement; "Not now" sets it aside until the next milestone, and the same choice
 * is always in Settings. It shows nothing while the companion is off.
 */
function CompanionFocusCardInner({ readingCount }: { readingCount: number }) {
  const prefs = usePrefs();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  if (hidden || !prefs.companionEnabled || !focusInvitationDue(readingCount, prefs.companionFocusAsked)) return null;

  const milestone = reachedMilestone(readingCount);
  const current = focusOption(prefs.companionFocus);

  async function setAside() {
    await savePrefs({ companionFocusAsked: milestone });
    setHidden(true);
  }

  return (
    <Card aria-labelledby="focus-invite" className="space-y-3">
      <SectionLabel id="focus-invite">You have made {readingCount} readings</SectionLabel>
      <p className="text-sm text-ink-soft">
        Would you like to tell your companion what you are working on? You do not have to. It is only about what it pays attention to when it
        asks you questions, and you can change or clear it at any time in Settings.
      </p>
      {current && <p className="text-xs text-ink-faint">Right now: {current.label}{prefs.companionFocusLine ? ` — “${prefs.companionFocusLine}”` : ""}</p>}
      {open ? (
        <CompanionFocusForm onDone={setAside} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setOpen(true)}>{current ? "Look at it again" : "Choose a focus"}</Button>
          <Button variant="quiet" onClick={setAside}>Not now</Button>
        </div>
      )}
    </Card>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function CompanionFocusCard(props: { readingCount: number }) {
  return FEATHERED ? null : <CompanionFocusCardInner {...props} />;
}
