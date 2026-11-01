"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/Page";
import InviteCodes from "@/components/InviteCodes";
import {
  CLAUDE_ACCOUNT_VIEWS,
  parseClaudeAccountView,
  splitClaudeAccounts,
  type ClaudeAccountView,
} from "@/lib/claude-accounts";

interface User {
  id: number;
  username: string;
  display_name: string | null;
  is_admin: number;
  claude_access: number;
  disabled: number;
  ai_daily_limit: number | null;
  ai_today: number;
  image_daily_limit: number | null;
  pictures_today: number;
  can_make_circles: number;
  created_at: string;
}

const VIEW_KEY = "ds-claude-accounts-view";

type Msg = { type: "ok" | "err"; text: string } | null;

/**
 * The owner's account list. Claude's test accounts (one per session) can be shown as one row, shown one by one, or
 * hidden; the choice is kept in this browser only.
 */
export default function UserManagement({ me }: { me: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Drawn after an effect, so the first render is the same on the server and in the browser.
  const [view, setView] = useState<ClaudeAccountView>("group");

  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserAdmin, setNewUserAdmin] = useState(false);
  const [userMsg, setUserMsg] = useState<Msg>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    try {
      setView(parseClaudeAccountView(window.localStorage.getItem(VIEW_KEY)));
    } catch {
      /* private window or blocked storage: keep the default */
    }
  }, []);

  function chooseView(next: ClaudeAccountView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* not saved; the choice still works for this visit */
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      setUsers(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(userId: number, body: Record<string, unknown>) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setUserMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername.trim(),
        display_name: newDisplayName.trim() || null,
        password: newUserPassword,
        is_admin: newUserAdmin,
      }),
    });
    if (res.ok) {
      setUserMsg({ type: "ok", text: `Account created for ${newUsername}` });
      setNewUsername("");
      setNewDisplayName("");
      setNewUserPassword("");
      setNewUserAdmin(false);
      load();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Could not create the account" }));
      setUserMsg({ type: "err", text: error });
    }
    setCreatingUser(false);
  }

  async function deleteUser(userId: number, username: string) {
    if (!confirm(`Delete account "${username}"? Their readings will also be deleted.`)) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    load();
  }

  function setAiLimit(userId: number, username: string, current: number | null) {
    const answer = prompt(
      `How many Claude requests a day for "${username}"? A whole number from 0 to 1000 (0 switches Claude help off for them). Leave empty to use the app's default.`,
      current === null ? "" : String(current)
    );
    if (answer === null) return;
    const value = answer.trim() === "" ? null : Number(answer.trim());
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 1000)) return;
    patch(userId, { ai_daily_limit: value });
  }

  function setPictureLimit(userId: number, username: string, current: number | null) {
    const answer = prompt(
      `How many pictures a day for "${username}"? A whole number from 0 to 1000 (0 switches picture-making off for them). Leave empty to use the app's default.`,
      current === null ? "" : String(current)
    );
    if (answer === null) return;
    const value = answer.trim() === "" ? null : Number(answer.trim());
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 1000)) return;
    patch(userId, { image_daily_limit: value });
  }

  function setAccountOff(userId: number, username: string, off: boolean) {
    if (off && !confirm(`Switch off "${username}"? They are signed out within a few seconds and cannot sign in until you switch the account back on. Nothing of theirs is deleted.`)) return;
    patch(userId, { disabled: off });
  }

  async function resetUserPassword(userId: number) {
    if (!resetPassword || resetPassword.length < 12) return;
    await patch(userId, { password: resetPassword });
    setResetTarget(null);
    setResetPassword("");
  }

  const { people, claude } = splitClaudeAccounts(users ?? [], me);
  const claudeCalls = claude.reduce((sum, u) => sum + u.ai_today, 0);
  const claudePictures = claude.reduce((sum, u) => sum + u.pictures_today, 0);
  const claudeOff = claude.filter((u) => u.disabled === 1).length;

  function row(u: User) {
    return (
      <div key={u.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 border-b border-line-faint last:border-0">
        <div>
          <span className="text-sm text-ink-strong">{u.username}</span>
          {u.display_name && <span className="text-xs text-ink-faint ml-2">({u.display_name})</span>}
          {u.is_admin === 1 && <span className="text-xs text-tone-400 ml-2">admin</span>}
          {u.disabled === 1 && <span className="text-xs text-danger-ink ml-2">switched off</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {resetTarget === u.id ? (
            <div className="flex items-center gap-2">
              <Input
                wide={false}
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password (12+)"
                aria-label={`New password for ${u.username}`}
                className="w-40"
              />
              <Button variant="text" onClick={() => resetUserPassword(u.id)}>Save</Button>
              <Button variant="text" onClick={() => { setResetTarget(null); setResetPassword(""); }}>Cancel</Button>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-1.5 text-xs text-ink-faint cursor-pointer">
                <input
                  type="checkbox"
                  checked={u.claude_access === 1}
                  onChange={(e) => patch(u.id, { claude_access: e.target.checked })}
                  className="accent-tone-500"
                />
                Claude key
              </label>
              {u.is_admin !== 1 && (
                <label className="flex items-center gap-1.5 text-xs text-ink-faint cursor-pointer" title="Lets this person make a circle and invite people who already have an account. Admins always can.">
                  <input
                    type="checkbox"
                    checked={u.can_make_circles === 1}
                    onChange={(e) => patch(u.id, { can_make_circles: e.target.checked })}
                    className="accent-tone-500"
                  />
                  Can make a circle
                </label>
              )}
              <Button variant="text" onClick={() => setResetTarget(u.id)}>Reset pw</Button>
              <Button
                variant="text"
                onClick={() => setAiLimit(u.id, u.username, u.ai_daily_limit)}
                title="Claude requests today / the daily limit. Press to change the limit."
              >
                Claude {u.ai_today}/{u.ai_daily_limit ?? "default"}
              </Button>
              <Button
                variant="text"
                onClick={() => setPictureLimit(u.id, u.username, u.image_daily_limit)}
                title="Pictures asked for today / the daily limit. Press to change the limit."
              >
                Pictures {u.pictures_today}/{u.image_daily_limit ?? "default"}
              </Button>
              {u.username !== me && (
                <Button variant="text" onClick={() => setAccountOff(u.id, u.username, u.disabled !== 1)}>
                  {u.disabled === 1 ? "Switch on" : "Switch off"}
                </Button>
              )}
              {u.username !== me && (
                <Button variant="danger" onClick={() => deleteUser(u.id, u.username)}>Delete</Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <p className="text-xs text-ink-faint">
          &ldquo;Claude key&rdquo; decides whether the shared Claude tool key can read and add readings for that
          account. New accounts start with it off.
        </p>

        {failed && <p role="alert" className="text-sm text-danger-ink">Could not load the accounts. Reload the page to try again.</p>}
        {users === null && !failed && <p className="text-sm text-ink-muted">Loading…</p>}

        {users !== null && (
          <>
            <div>{people.map(row)}</div>

            {claude.length > 0 && (
              <section aria-labelledby="claude-accounts" className="border-t border-line-faint pt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel id="claude-accounts">Claude&rsquo;s test accounts</SectionLabel>
                  <div role="group" aria-label="How to show Claude's test accounts" className="flex gap-1">
                    {CLAUDE_ACCOUNT_VIEWS.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => chooseView(v.value)}
                        aria-pressed={view === v.value}
                        className={`text-xs px-2.5 py-1 min-h-11 sm:min-h-0 rounded-full border transition-colors ${
                          view === v.value
                            ? "bg-tone-700/30 border-tone-600 text-tone-200"
                            : "border-line-strong text-ink-faint hover:border-line-hover hover:text-ink-soft"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {view === "group" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-ink-strong">
                      {claude.length} {claude.length === 1 ? "account" : "accounts"}
                      {claudeOff > 0 && <span className="text-xs text-danger-ink ml-2">{claudeOff} switched off</span>}
                    </span>
                    <span className="text-xs text-ink-faint">
                      Claude {claudeCalls} today &middot; Pictures {claudePictures} today
                    </span>
                  </div>
                )}
                {view === "each" && <div>{claude.map(row)}</div>}
                {view === "hide" && (
                  <p className="text-xs text-ink-faint">
                    {claude.length} {claude.length === 1 ? "account is" : "accounts are"} hidden. Their data is untouched.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-ink-strong">Add Account</h2>
        <form onSubmit={createUser} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username" aria-label="Username" required />
            <Input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Display name (optional)" aria-label="Display name" />
          </div>
          <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Password (12 or more characters)" aria-label="Password" required minLength={12} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isAdmin" checked={newUserAdmin} onChange={(e) => setNewUserAdmin(e.target.checked)} className="accent-tone-500" />
            <label htmlFor="isAdmin" className="text-sm text-ink-muted">Admin account</label>
          </div>
          {userMsg && <p role={userMsg.type === "ok" ? "status" : "alert"} className={`text-sm ${userMsg.type === "ok" ? "text-success-ink" : "text-danger-ink"}`}>{userMsg.text}</p>}
          <Button type="submit" variant="purple" disabled={creatingUser}>
            {creatingUser ? "Creating..." : "Create Account"}
          </Button>
        </form>
      </Card>

      <Card>
        <InviteCodes />
      </Card>
    </div>
  );
}
