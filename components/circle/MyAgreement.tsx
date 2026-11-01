"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CircleView } from "@/lib/circles-core";
import SharingNotice from "./SharingNotice";

type Circle = NonNullable<CircleView["circle"]>;

/**
 * A member's own choice to use the circle owner's Claude key (and, later, picture computer) for what they send, and to stop at any time (open item C5).
 * People who joined before keys existed are not counted as agreeing: they read the notice and tick the box first.
 */
export default function MyAgreement({ circle, busy, onChange, host = false }: { circle: Circle; busy: boolean; onChange: (agreed: boolean) => void; host?: boolean }) {
  const [ticked, setTicked] = useState(false);
  const { claude: c, i_agreed: agreed } = circle;

  return (
    <section aria-labelledby="circle-my-agreement" className="space-y-3 border border-line-faint rounded-control p-4">
      <h2 id="circle-my-agreement" className="text-sm text-ink-muted font-medium">Your Claude requests and pictures</h2>
      {agreed ? (
        <>
          <p className="text-sm text-ink-soft">
            {c.has_key
              ? `When you ask Claude for help, it goes through this circle's key, up to ${c.member_limit} requests a day for you.`
              : "This circle has no Claude key yet, so the app's own Claude is used for you. If a key is added, your requests will go through it."}
          </p>
          <p className="text-sm text-ink-soft">
            {circle.pictures.has_computer
              ? `The pictures you ask for are made on the circle's picture computer, which is ${circle.pictures.awake ? "awake" : "asleep right now, so they wait until it wakes"}.`
              : "This circle has no picture computer yet, so the app's own is used for your pictures."}
          </p>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Stop using this circle's Claude key and picture computer? Nothing you wrote is deleted, and you stay in the circle.")) return;
              onChange(false);
            }}
          >
            Stop using the circle&apos;s key and computer
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {c.has_key ? "This circle has a Claude key. It is not used for you; the app's own Claude is." : "The app's own Claude is used for you."}{" "}
            You can choose to use the circle&apos;s instead.
          </p>
          <SharingNotice headingId="circle-my-notice" host={host} />
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="mt-1" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
            <span>I have read this and I agree</span>
          </label>
          <Button disabled={busy || !ticked} onClick={() => onChange(true)}>Use the circle&apos;s key and computer</Button>
        </>
      )}
    </section>
  );
}
