"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import RecoveryCodes from "@/components/account/RecoveryCodes";

/** Settings: the recovery codes that let a person set a new password if they forget it, and signing out everywhere. */
export default function AccountAccess() {
  const [outMsg, setOutMsg] = useState<string | null>(null);

  async function signOutEverywhere() {
    setOutMsg(null);
    const res = await fetch("/api/settings/sign-out-everywhere", { method: "POST" }).catch(() => null);
    setOutMsg(res?.ok ? "Done. Every other device is signed out. You are still signed in here." : "Could not do that. Try again.");
  }

  return (
    <Card className="space-y-5" role="region" aria-labelledby="access-title">
      <h3 id="access-title" className="font-semibold text-ink-strong">Signing in and getting back in</h3>

      <RecoveryCodes />

      <div className="space-y-2 border-t border-line pt-4">
        <h4 className="text-sm font-medium text-ink-strong">Sign out everywhere</h4>
        <p className="text-xs text-ink-faint">
          Signs you out on every phone and computer where you are signed in, except this one. Use it if you left an account open on a shared
          computer or lost a device. Signing in lasts two weeks on each device.
        </p>
        <Button variant="quiet" onClick={signOutEverywhere} className="border border-line-strong">Sign out of all other devices</Button>
        {outMsg && <p role="status" className="text-sm text-ink-soft">{outMsg}</p>}
      </div>
    </Card>
  );
}
