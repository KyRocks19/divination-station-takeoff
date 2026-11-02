"use client";

import { FEATHERED } from "@/lib/edition";
import { useAiReady } from "@/components/AiReady";
import { useState, useEffect } from "react";
import SigilCanvas from "@/components/SigilCanvas";
import DaysFolder from "@/components/DaysFolder";
import SigilDisplay from "@/components/SigilDisplay";
import { usePrefs, savePrefs } from "@/components/usePrefs";
import type { Prefs } from "@/lib/prefs-shared";
import { fieldFullClass } from "@/components/ui/Field";
import { JumpLinks, PageTitle, type JumpItem } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";
import { CompanionExplanation } from "@/components/CompanionPanel";
import CompanionFocusForm from "@/components/CompanionFocusForm";
import CompanionNoticed from "@/components/CompanionNoticed";
import ComfortSettings, { LayoutSettings } from "@/components/ComfortSettings";
import { SensitiveMeaningsSetting } from "@/components/SensitiveMeanings";
import AdultSetting from "@/components/AdultSetting";
import PasskeySettings from "@/components/PasskeySettings";
import RecentPagesSetting from "@/components/RecentPagesSetting";
import RecentSearchesSetting from "@/components/RecentSearchesSetting";
import { clearRecentPages } from "@/lib/recent-pages-store";
import DeleteAccount from "@/components/account/DeleteAccount";
import AccountAccess from "@/components/account/AccountAccess";
import ClaudeTokens from "@/components/account/ClaudeTokens";
import QuickExitSettings from "@/components/QuickExitSettings";
import ImportData from "@/components/account/ImportData";
import LocalBackups from "@/components/account/LocalBackups";
import LocalLock from "@/components/account/LocalLock";
import SettingsIndex from "@/components/SettingsIndex";
import { SigilMark } from "@/components/ui/AppSigil";
import { useRevealWait } from "@/components/reveal/useRevealWait";
import { REVEAL_WAIT_CHOICES } from "@/lib/reveal-wait-core";

export default function SettingsPage() {
  const [me, setMe] = useState<{ username: string; isAdmin: boolean; edition?: string; host?: boolean } | null>(null);

  // Change own password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  // Sigil
  const [sigilData, setSigilData] = useState<string | null>(null);
  const [sigilLoaded, setSigilLoaded] = useState(false);
  const [sigilMsg, setSigilMsg] = useState<{ type: "ok" | "err"; text: React.ReactNode } | null>(null);

  // RNG method
  const [rngMethod, setRngMethod] = useState<string>("math");
  const [rngMsg, setRngMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Display preferences
  const prefs = usePrefs();
  // Each AI setting is shown only when this copy can run that feature (lib/ai-ready-core.ts).
  const ai = useAiReady();
  const [revealWait, setRevealWait] = useRevealWait();
  // Which card the last change was made in, so "Saved" shows there.
  const [prefsMsg, setPrefsMsg] = useState<{ type: "ok" | "err"; text: string; where: "guide" | "companion" } | null>(null);

  async function changePrefs(change: Partial<Prefs>, where: "guide" | "companion") {
    const ok = await savePrefs(change);
    setPrefsMsg(ok ? { type: "ok", text: "Saved", where } : { type: "err", text: "Could not save", where });
    if (ok) setTimeout(() => setPrefsMsg(null), 2000);
  }

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      setMe({ username: d.username, isAdmin: d.isAdmin, edition: d.edition, host: d.host });
    });
    fetch("/api/sigil").then((r) => r.json()).then((d) => {
      setSigilData(d.sigil_data ?? null);
      setSigilLoaded(true);
    }).catch(() => { setSigilLoaded(true); });
    fetch("/api/rng-method").then((r) => r.json()).then((d) => {
      if (d.method) setRngMethod(d.method);
    }).catch(() => {/* keep default */});
  }, []);

  async function saveSigil(data: string | null) {
    setSigilMsg(null);
    const res = await fetch("/api/sigil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sigil_data: data }),
    });
    if (res.ok) {
      setSigilData(data);
      setSigilMsg({ type: "ok", text: data ? <>Sigil sealed <SigilMark /></> : "Sigil removed" });
    } else {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      setSigilMsg({ type: "err", text: error });
    }
  }

  async function saveRngMethod(method: string) {
    setRngMsg(null);
    setRngMethod(method);
    const res = await fetch("/api/rng-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (res.ok) {
      setRngMsg({ type: "ok", text: "Saved" });
      setTimeout(() => setRngMsg(null), 2000);
    } else {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      setRngMsg({ type: "err", text: error });
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPw) { setPwMsg({ type: "err", text: "Passwords do not match" }); return; }
    setSavingPw(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      setPwMsg({ type: "ok", text: "Password updated" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPw("");
    } else {
      const { error } = await res.json();
      setPwMsg({ type: "err", text: error });
    }
    setSavingPw(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearRecentPages();
    // A full page load, so the signed-out page is drawn without the navigation.
    window.location.assign("/login");
  }

  const choiceClass = (on: boolean) =>
    on ? "bg-tone-700/30 border-tone-600 text-tone-200" : "border-line-strong text-ink-muted hover:border-line-hover hover:text-ink-strong";

  const savedNote = (where: "guide" | "companion") =>
    prefsMsg?.where === where && (
      <p role={prefsMsg.type === "ok" ? "status" : "alert"} className={`text-sm ${prefsMsg.type === "ok" ? "text-success-ink" : "text-danger-ink"}`}>{prefsMsg.text}</p>
    );

  return (
    <div className="@container max-w-7xl mx-auto px-4 pt-8 pb-16">
      <PageTitle>Settings</PageTitle>

      {/* Narrower: a row of links to the sections. Wide enough: the full index in its own column, in view while the page scrolls. */}
      <JumpLinks items={SECTIONS} className="mt-4 @6xl:hidden" />

      <div className="mt-6 @6xl:grid @6xl:grid-cols-[13rem_minmax(0,1fr)] @6xl:gap-8 @6xl:items-start">
        <SettingsIndex
          of="settings-sections"
          className="hidden @6xl:block sticky top-[calc(var(--header-h)+1rem)] max-h-[calc(100dvh-var(--header-h)-2rem)] overflow-y-auto pr-1"
        />

        <div id="settings-sections" className="space-y-12 min-w-0">
          <Section id="look" title="Look and comfort">
            <Item id="comfort" label="Reading comfort">
              <ComfortSettings />
            </Item>

            {/* The right-hand column: Colours, then Layout under it, so Layout does not wait below the long comfort card. */}
            <div className="space-y-6 min-w-0">
              <Item id="colours" label="Colours">
                <div className="bg-surface border border-line rounded-card p-5 space-y-3">
                  <h3 className="font-semibold text-ink-strong">Colours</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Make the app look the way you feel at home in it. Start from one of seven themes or choose any colour yourself. It is
                    saved with your profile and follows you to every device.
                  </p>
                  <ButtonLink href="/design" variant="primary">Choose your colours</ButtonLink>
                </div>
              </Item>

              <Item id="layout" label="Layout">
                <LayoutSettings />
              </Item>
            </div>
          </Section>

          <Section id="guidance" title="Readings and guidance">
            <Item id="guide" label="How the app guides you">
              <div className="bg-surface border border-line rounded-card p-5 space-y-5">
                <div>
                  <h3 className="font-semibold text-ink-strong">How the App Guides You</h3>
                  <p className="text-xs text-ink-faint mt-0.5">
                    These change what is shown, never what is saved. Your own notes and meanings are always shown first.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">Explanations</p>
                  <div className="flex flex-col gap-2" role="group" aria-label="Explanations">
                    {([
                      { value: "more", label: "More", desc: "Short explanations and hints are shown, and correspondences start open. Good while learning." },
                      { value: "less", label: "Less", desc: "Just the cards, the correspondences, and your notes. Good once you know your way around." },
                    ] as const).map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => changePrefs({ scaffolding: value }, "guide")}
                        aria-pressed={prefs.scaffolding === value}
                        className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${choiceClass(prefs.scaffolding === value)}`}
                      >
                        <span className="font-medium">{label}</span>
                        <span className="block text-xs text-ink-muted mt-0.5">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">Hemisphere</p>
                  <p className="text-xs text-ink-faint">
                    Decides which seasonal festival a reading falls near. Samhain is in October in the north and in May in the south.
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Hemisphere">
                    {([
                      { value: "north", label: "Northern" },
                      { value: "south", label: "Southern" },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => changePrefs({ hemisphere: value }, "guide")}
                        aria-pressed={prefs.hemisphere === value}
                        className={`flex-1 px-4 py-2 rounded-lg border text-sm transition-colors ${choiceClass(prefs.hemisphere === value)}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.lookbackPrompts}
                    onChange={(e) => changePrefs({ lookbackPrompts: e.target.checked }, "guide")}
                    className="accent-tone-600 mt-1"
                  />
                  <span>
                    <span className="text-sm text-ink-soft">Suggest things to come back to</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      At the top of today&rsquo;s page: up to three predictions whose date has come, and up to three older readings
                      with no look-back entry yet. You can dismiss each one.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.guessFirst}
                    onChange={(e) => changePrefs({ guessFirst: e.target.checked }, "guide")}
                    className="accent-tone-600 mt-1"
                  />
                  <span>
                    <span className="text-sm text-ink-soft">Write what I sense before I read the meanings</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      Each reading first asks what you sense, and keeps its meanings closed until you have written it or skipped.
                      Your words are sealed when saved, so you can later say how well they fitted. Nothing is graded{ai.companion ? ", and the companion never sees these words" : ""}.
                      Turn this off to see meanings straight away.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.oraclePrompts}
                    onChange={(e) => changePrefs({ oraclePrompts: e.target.checked }, "guide")}
                    className="accent-tone-600 mt-1"
                  />
                  <span>
                    <span className="text-sm text-ink-soft">Show questions in the oracle deck</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      Shows one question at a time on the deck page and on a card with no words yet, for when you are not
                      sure what to make or write. The questions are fixed text and never fill anything in.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.daysListReadings}
                    onChange={(e) => changePrefs({ daysListReadings: e.target.checked }, "guide")}
                    className="accent-tone-600 mt-1"
                  />
                  <span>
                    <span className="text-sm text-ink-soft">List the day&rsquo;s readings on each day&rsquo;s page</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      Each day&rsquo;s page shows links to the readings you made that day, with nothing copied. Turn this off if you make a lot of readings
                      and would rather keep the page for your own writing and what you choose to add.
                    </span>
                  </span>
                </label>

                {ai.pictures && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.artHelp}
                    onChange={(e) => changePrefs({ artHelp: e.target.checked }, "guide")}
                    className="accent-tone-600 mt-1"
                  />
                  <span>
                    <span className="text-sm text-ink-soft">Offer to make pictures for oracle items</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      Shows &ldquo;Make pictures&rdquo; on an item&rsquo;s page, which asks an image tool running on your own computer
                      for pictures from your own words. It only runs when you press the button, and nothing leaves your computer.
                      You choose which pictures to keep.
                    </span>
                  </span>
                </label>
                )}

                {savedNote("guide")}
              </div>
            </Item>

            {ai.companion && (
            <Item id="companion" label="AI companion">
              <div className="bg-surface border border-line rounded-card p-5 space-y-3">
                <h3 className="font-semibold text-ink-strong">AI Companion</h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.companionEnabled}
                    disabled={!prefs.adultConfirmed}
                    onChange={(e) => changePrefs({ companionEnabled: e.target.checked }, "companion")}
                    className="accent-tone-600 mt-1"
                  />
                  <span>
                    <span className="text-sm text-ink-soft">Turn on the AI companion</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      Off until you turn it on. It asks questions about what you wrote, using only your own words. Read how it works below.
                      {!prefs.adultConfirmed && (
                        <> It is for adults: confirm your age under <a href="#age" className="underline text-accent-ink hover:text-accent-ink-hover">Age</a> to turn it on.</>
                      )}
                    </span>
                  </span>
                </label>
                <details className="ml-7">
                  <summary className="text-xs text-accent-ink cursor-pointer">How the companion works</summary>
                  <div className="mt-2"><CompanionExplanation /></div>
                </details>
                <div className="ml-7">
                  <label htmlFor="companion-name" className="block text-xs text-ink-faint mb-1">Its name (leave empty for &ldquo;Companion&rdquo;)</label>
                  <input
                    id="companion-name"
                    key={prefs.companionName}
                    defaultValue={prefs.companionName === "Companion" ? "" : prefs.companionName}
                    maxLength={40}
                    onBlur={(e) => { if (e.target.value.trim() !== (prefs.companionName === "Companion" ? "" : prefs.companionName)) changePrefs({ companionName: e.target.value }, "companion"); }}
                    className="bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong placeholder-ink-ghost focus:outline-none focus:border-focus w-full max-w-xs"
                    placeholder="Companion"
                  />
                </div>
                <details className="ml-7">
                  <summary className="text-xs text-accent-ink cursor-pointer">
                    What I want from it{prefs.companionFocus || prefs.companionFocusLine ? " (set)" : " (not set)"}
                  </summary>
                  <div className="mt-2"><CompanionFocusForm /></div>
                </details>
                <details className="ml-7">
                  <summary className="text-xs text-accent-ink cursor-pointer">
                    What I have noticed about how I like to work{prefs.companionNote ? " (set)" : " (not set)"}
                  </summary>
                  <div className="mt-2"><CompanionNoticed /></div>
                </details>
                {savedNote("companion")}
              </div>
            </Item>
            )}

            <Item id="opening-wait" label="How long a reading opens">
              <div className="bg-surface border border-line rounded-card p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-ink-strong">How Long a Reading Opens</h3>
                  <p className="text-xs text-ink-faint mt-0.5">
                    Before a new reading is shown, your question stays on the screen while the cards shuffle (or the tea brews, or the
                    pendulum swings). Choose how long that lasts. &ldquo;I am ready&rdquo; or Escape ends it early. Kept only in this
                    browser on this device, not in your account.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="How long a reading opens">
                  {REVEAL_WAIT_CHOICES.map(({ seconds, label }) => (
                    <button
                      key={seconds}
                      onClick={() => setRevealWait(seconds)}
                      aria-pressed={revealWait === seconds}
                      className={`px-4 py-2 min-h-11 rounded-lg border text-sm transition-colors ${choiceClass(revealWait === seconds)}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Item>

            <Item id="randomness" label="Card draw randomness">
              <div className="bg-surface border border-line rounded-card p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-ink-strong">Card Draw Randomness</h3>
                  <p className="text-xs text-ink-faint mt-0.5">
                    Choose the source of randomness used when cards are drawn.
                  </p>
                </div>
                <div className="flex flex-col gap-2" role="group" aria-label="RNG method">
                  {([
                    { value: "math",       label: "Math.random()",  desc: "Fast pseudorandom — the JavaScript default" },
                    { value: "crypto",     label: "crypto",         desc: "Cryptographically secure, built into the browser and server" },
                    { value: "random.org", label: "random.org",     desc: "True random numbers from atmospheric noise (requires internet)" },
                  ] as const).filter(({ value }) => !(FEATHERED && value === "random.org")).map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => saveRngMethod(value)}
                      aria-pressed={rngMethod === value}
                      className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${choiceClass(rngMethod === value)}`}
                    >
                      <span className="font-medium font-mono">{label}</span>
                      <span className="block text-xs text-ink-muted mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
                {rngMsg && (
                  <p role={rngMsg.type === "ok" ? "status" : "alert"} className={`text-sm ${rngMsg.type === "ok" ? "text-success-ink" : "text-danger-ink"}`}>
                    {rngMsg.text}
                  </p>
                )}
              </div>
            </Item>
          </Section>

          <Section id="content" title="Age and content">
            <Item id="age" label="Age">
              <AdultSetting />
            </Item>
            <Item id="sensitive" label="Sensitive meanings">
              <SensitiveMeaningsSetting />
            </Item>
          </Section>

          <Section id="privacy" title="Privacy and safety">
            <Item id="quick-exit" label="Quick hide">
              <QuickExitSettings canStop={!!me?.isAdmin && me.edition === "local"} />
            </Item>
            <Item id="lock" label="Lock my data">
              <LocalLock />
            </Item>
            <Item id="recent-pages" label="Recent pages">
              <RecentPagesSetting username={me?.username} />
            </Item>
            <Item id="recent-searches" label="Recent searches">
              <RecentSearchesSetting />
            </Item>
          </Section>

          <Section id="account" title="Account and sign-in">
            <Item id="password" label="Change your password">
              <div className="bg-surface border border-line rounded-card p-5 space-y-4">
                <h3 className="font-semibold text-ink-strong">Change Your Password</h3>
                {me && <p className="text-xs text-ink-faint">Signed in as <span className="text-tone-400">{me.username}</span></p>}
                <form onSubmit={changePassword} className="space-y-3">
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password" aria-label="Current password" autoComplete="current-password" required className={fieldFullClass} />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password" aria-label="New password" autoComplete="new-password" required minLength={12} className={fieldFullClass} />
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password" aria-label="Confirm new password" autoComplete="new-password" required className={fieldFullClass} />
                  {pwMsg && <p role={pwMsg.type === "ok" ? "status" : "alert"} className={`text-sm ${pwMsg.type === "ok" ? "text-success-ink" : "text-danger-ink"}`}>{pwMsg.text}</p>}
                  <button type="submit" disabled={savingPw}
                    className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors">
                    {savingPw ? "Saving..." : "Update Password"}
                  </button>
                </form>
              </div>
            </Item>

            <Item id="passkeys" label="Passkeys">
              <PasskeySettings />
            </Item>

            <Item id="getting-back-in" label="Signing in and getting back in">
              <AccountAccess />
            </Item>

            <Item id="sigil" label="Signature sigil">
              <div className="bg-surface border border-line rounded-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-ink-strong">Signature Sigil</h3>
                    <p className="text-xs text-ink-faint mt-0.5">
                      Draw a personal seal. It marks your own readings, and only you can see it.
                    </p>
                  </div>
                  {sigilData && <SigilDisplay sigilData={sigilData} size={48} />}
                </div>

                {sigilLoaded && (
                  <SigilCanvas
                    onSave={saveSigil}
                    initialData={sigilData}
                    size={200}
                  />
                )}

                {sigilMsg && (
                  <p role={sigilMsg.type === "ok" ? "status" : "alert"} className={`text-sm ${sigilMsg.type === "ok" ? "text-success-ink" : "text-danger-ink"}`}>
                    {sigilMsg.text}
                  </p>
                )}
              </div>
            </Item>

            {/* Admin: user management has its own page */}
            {me?.isAdmin && (me.edition !== "local" || me.host) && (
              <Item id="users" label="Users">
                <div className="bg-surface border border-line rounded-card p-5 space-y-3">
                  <h3 className="font-semibold text-ink-strong">Users</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Add and switch off accounts, set daily limits, reset passwords, and make invite codes.
                  </p>
                  <ButtonLink href="/admin/users" variant="primary">Manage users</ButtonLink>
                </div>
              </Item>
            )}

            <Item id="claude-code" label="Claude Code integration">
              <ClaudeTokens />
            </Item>

            <Item id="session" label="Log out">
              <div className="bg-surface border border-line rounded-card p-5">
                <h3 className="font-semibold text-ink-strong mb-3">Session</h3>
                <button onClick={logout}
                  className="text-sm text-danger hover:text-danger-ink border border-danger/25 rounded-lg px-4 py-2 min-h-11 sm:min-h-0 transition-colors">
                  Logout
                </button>
              </div>
            </Item>
          </Section>

          <Section id="records" title="Your records">
            <Item id="export" label="Export your records">
              <div className="bg-surface border border-line rounded-card p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-ink-strong">Export Your Records</h3>
                  <p className="text-xs text-ink-faint mt-0.5">
                    Download everything you have recorded: readings from every tool, the sky at each one, journal entries,
                    your own meanings and their earlier versions (cards, oracle decks, runes, ogham, dice, pendulum, hexagrams, geomantic figures),
                    {FEATHERED
                      ? "concept notes, layouts, tags and your colours."
                      : ai.claude
                        ? "concept notes, layouts, tags, your colours, and your circle (its members' names, what you agreed to, and your own Claude request counts; never a key or a code)."
                        : "concept notes, layouts, tags, your colours, and your circle (its members' names and what you agreed to; never a key or a code)."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/export?format=md"
                    className="flex-1 text-center text-sm border border-line-strong hover:border-line-hover text-tone-300 px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
                  >
                    Readable journal (.md)
                  </a>
                  <a
                    href="/api/export?format=json"
                    className="flex-1 text-center text-sm border border-line-strong hover:border-line-hover text-tone-300 px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
                  >
                    Complete data (.json)
                  </a>
                </div>
                <p className="text-xs text-ink-ghost">
                  Who can see your writing, and what the app does with it: <a href="/privacy" className="underline hover:text-ink-soft">Privacy and terms</a>.
                </p>
              </div>
            </Item>

            {/* The home page links here (/settings#bring-in). */}
            <Item id="bring-in" label="Bring in your records">
              <ImportData />
            </Item>

            {/* Moved here from the Days page (owner's request, 2026-10-30), which links to it (/settings#days-folder). */}
            <Item id="days-folder" label="Your days in a folder">
              <DaysFolder />
            </Item>

            <Item id="backups" label="Back up and restore">
              <LocalBackups />
            </Item>

            <Item id="delete-account" label="Delete my account">
              <DeleteAccount />
            </Item>
          </Section>
        </div>
      </div>
    </div>
  );
}

/** The sections of the page, in order, for the "Jump to" row. Each always holds at least one setting. */
const SECTIONS: JumpItem[] = [
  { id: "look", label: "Look and comfort" },
  { id: "guidance", label: "Readings and guidance" },
  { id: "content", label: "Age and content" },
  { id: "privacy", label: "Privacy and safety" },
  { id: "account", label: "Account and sign-in" },
  { id: "records", label: "Your records" },
];

/** One section of settings: its heading, then its cards, in two columns when the page is wide enough (a container query, so
 *  the side menu and larger text are counted). */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} data-settings-section={title} className="space-y-4">
      <h2 id={`${id}-h`} className="text-lg font-semibold text-heading border-b border-line pb-1">{title}</h2>
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6 items-start">{children}</div>
    </section>
  );
}

/** The box around one setting, which the index links to. A setting that draws nothing here leaves it empty, and an empty box
 *  takes no room in the grid and is left out of the index (components/SettingsIndex.tsx). */
function Item({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div id={id} data-settings-item={label} className="min-w-0 empty:hidden">
      {children}
    </div>
  );
}
