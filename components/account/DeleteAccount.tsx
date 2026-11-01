"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { DELETE_PHRASE } from "@/lib/account-deletion";
import { clearRecentPages } from "@/lib/recent-pages-store";

/** "Delete my account" in Settings: the password is asked again and a phrase is typed. There is no undo. */
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);

  // The button that was pressed goes away, so keyboard and screen-reader focus would fall to the page top. Move it to the
  // password field on open, and back to the opening button on "Keep my account".
  useEffect(() => {
    if (!asked.current) return;
    document.getElementById(open ? "delete-password" : "delete-open")?.focus();
  }, [open]);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: phrase }),
      });
      if (res.ok) {
        // The list of recent pages kept on this device goes too; then a full page load, so the signed-out page is drawn without the navigation.
        clearRecentPages();
        window.location.assign("/login");
        return;
      }
      const { error: message } = await res.json().catch(() => ({ error: "Could not delete the account." }));
      setError(message);
    } catch {
      setError("Could not reach the server. Nothing was deleted.");
    }
    setBusy(false);
  }

  return (
    <Card className="space-y-3" aria-labelledby="delete-account-title" role="region">
      <div>
        <h3 id="delete-account-title" className="font-semibold text-ink-strong">Delete My Account</h3>
        <p className="text-xs text-ink-faint mt-0.5">
          This removes your account and everything you have written or made here: readings, journals, your own decks and meanings,
          pictures, days and layouts. It cannot be undone. If you own a circle, it passes to the member who joined first. Your forum
          posts and comments go too. Download your records above first if you want to keep a copy.
        </p>
      </div>
      {!open ? (
        <Button id="delete-open" variant="danger" onClick={() => { asked.current = true; setOpen(true); }}>I want to delete my account</Button>
      ) : (
        <form onSubmit={remove} className="space-y-3">
          <Field htmlFor="delete-password" label="Your password">
            <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field htmlFor="delete-phrase" label={`Type “${DELETE_PHRASE}” to confirm`}>
            <Input id="delete-phrase" autoComplete="off" value={phrase} onChange={(e) => setPhrase(e.target.value)} required />
          </Field>
          {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="purple" disabled={busy || !password || !phrase.trim()}>
              {busy ? "Deleting…" : "Delete my account for good"}
            </Button>
            <Button variant="quiet" onClick={() => { setOpen(false); setPassword(""); setPhrase(""); setError(null); }}>Keep my account</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
