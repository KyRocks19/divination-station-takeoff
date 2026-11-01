"use client";

import type { Shape } from "@/lib/edition";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import {
  MIN_QUERY,
  SEARCH_OPTIONS,
  cleanOptions,
  cleanQuery,
  countItems,
  type SearchAnswer,
  type SearchItem,
  type SearchOption,
} from "@/lib/search-shared";
import type { RecentState } from "@/lib/recent-searches-core";

/** Wait this long after the last key before asking the server. */
const PAUSE_MS = 180;

/** Where the ticked extra places are remembered: on this device only, as a short list. */
const OPTIONS_KEY = "ds-search-also";

function readOptions(): SearchOption[] {
  try {
    return cleanOptions(JSON.parse(window.localStorage.getItem(OPTIONS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function saveOptions(list: SearchOption[]) {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(list));
  } catch {
    // The choice then lasts until the window is closed.
  }
}

/** The person's own day on this device (YYYY-MM-DD), sent so "yesterday" means their yesterday. */
function localDay(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * The search button in the header bar and the search window it opens (the user's choice, 2026-10-16). Ctrl+K (Cmd+K on
 * a Mac) opens it from any page. One Tab stop in the header.
 *
 * Inside the window the typing field is a combobox (WAI-ARIA "list autocomplete with automatic selection"): the results
 * are a listbox of options grouped by kind, the first one is chosen as results arrive, Up and Down move the choice,
 * Enter opens it, and the field keeps focus the whole time. The count of results is read out through a status line.
 * Each option is a real link (not a Tab stop), so a click, a tap, Ctrl+click or a middle click all work as on any link.
 * The window is a native modal <dialog>: the page behind cannot be reached, Escape closes it, and focus returns to the
 * button. It fills the screen on a phone.
 *
 * The words typed go to the server in the body of a POST, never in an address. Only the person's own writing is searched
 * besides the shared things (lib/search.ts).
 *
 * Recent searches are off until the person turns them on, here, in the window (migration 071). When on, the words of a
 * search are kept when the person opens one of its results, and shown while the field is empty; the person can run one
 * again, remove one, clear them all or turn the whole thing off, which also deletes them.
 *
 * Two more places can be ticked under "Also look in": earlier versions of the person's meanings, and the forum's comments in
 * their circle. Both are off until ticked, and the choice is kept on this device (localStorage, in try/catch), not in the account.
 */
export default function SiteSearch({ edition }: { edition?: Shape }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cache = useRef(new Map<string, SearchAnswer>());
  const base = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  // The query being asked about right now, so "Searching…" shows only for the words in the field.
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  // Recent searches: null until the first answer, then whatever the server says. `notice` is the line read out after a change.
  const [recent, setRecent] = useState<RecentState | null>(null);
  const [notice, setNotice] = useState("");
  // The extra places the person ticked. Read from the device after the page has loaded, so the first render never depends on the browser.
  const [also, setAlso] = useState<SearchOption[]>([]);
  const places = SEARCH_OPTIONS.filter((o) => !(edition === "local" && o.id === "comments"));

  useEffect(() => setAlso(readOptions()), []);

  function toggleAlso(id: SearchOption, on: boolean) {
    const next = cleanOptions(on ? [...also, id] : also.filter((x) => x !== id));
    setAlso(next);
    saveOptions(next);
    setNotice(`${SEARCH_OPTIONS.find((o) => o.id === id)?.label}: ${on ? "on" : "off"}.`);
  }

  const ids = {
    also: `${base}-also`,
    recent: `${base}-recent`,
    title: `${base}-title`,
    input: `${base}-input`,
    list: `${base}-list`,
    hint: `${base}-hint`,
    option: (i: number) => `${base}-opt-${i}`,
  };

  const q = cleanQuery(text);
  const shown = answer && answer.query === q ? answer : null;
  const items: SearchItem[] = shown ? shown.groups.flatMap((g) => g.items) : [];
  const count = shown ? countItems(shown.groups) : 0;

  // The <dialog> element follows `open`: showModal makes the rest of the page unreachable until it closes.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      input.current?.focus();
      // What was searched last is kept and selected, so typing replaces it and the arrows go back to its results.
      input.current?.select();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Each time the window opens, ask what is saved. A failure just means no recent searches are shown.
  useEffect(() => {
    if (!open) return;
    setNotice("");
    const ctrl = new AbortController();
    fetch("/api/search/recent", { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<RecentState>) : null))
      .then(setRecent)
      .catch(() => {});
    return () => ctrl.abort();
  }, [open]);

  // Ctrl+K or Cmd+K opens the window from anywhere; pressed again inside, it selects the words to type over them.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      // Another window open over the page (the feedback form) keeps its keys.
      const other = document.querySelector("dialog[open]");
      if (other && other !== dialog.current) return;
      e.preventDefault();
      if (dialog.current?.open) input.current?.select();
      else setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Ask the server after a pause in typing. An answer already fetched in this window is shown at once.
  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    // The day is part of the key: a window left open past midnight must not answer "yesterday" with yesterday's answer.
    const today = localDay();
    const shownAlso = also.filter((id) => places.some((o) => o.id === id));
    const key = `${today}|${shownAlso.join(",")}|${q}`;
    const known = cache.current.get(key);
    if (known) {
      setAnswer(known);
      setActive(0);
      setFailed(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setPending(q);
      setFailed(false);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, today, options: shownAlso }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const data = (await res.json()) as SearchAnswer;
        cache.current.set(key, data);
        setAnswer(data);
        setActive(0);
        setFailed(false);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.error(err);
        setFailed(true);
      } finally {
        setPending((p) => (p === q ? null : p));
      }
    }, PAUSE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `also` is a new list only when a box is ticked or cleared; `edition` never changes while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, also.join(",")]);

  // Keep the chosen option in view as the arrows move it.
  useEffect(() => {
    if (!open || items.length === 0) return;
    document.getElementById(`${base}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, items.length, base]);

  const close = useCallback(() => setOpen(false), []);

  /** Saves the words just searched for, when the person has turned recent searches on. Not waited for. */
  function keepWords() {
    if (!recent?.on || q.length < MIN_QUERY) return;
    fetch("/api/search/recent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
      keepalive: true,
    }).catch(() => {});
  }

  function go(item: SearchItem) {
    keepWords();
    close();
    router.push(item.href);
  }

  /** One request about recent searches; the answer replaces what is shown, and `said` is read out. */
  async function changeRecent(said: string, method: "PUT" | "DELETE", path = "", body?: unknown) {
    try {
      const res = await fetch(`/api/search/recent${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`recent ${res.status}`);
      setRecent((await res.json()) as RecentState);
      setNotice(said);
      // The button that was pressed is gone or changed: keep the person where they type, and let the status line say what happened.
      input.current?.focus();
    } catch (err) {
      console.error(err);
      setNotice("That did not work. Try again in a moment.");
    }
  }

  function reuse(words: string) {
    setText(words);
    input.current?.focus();
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[Math.min(active, items.length - 1)]);
    }
  }

  // The line that is read out: only the outcome, never "searching", so a screen reader is not interrupted while typing.
  let status = "";
  if (q.length >= MIN_QUERY && failed) status = "The search did not work. Try again in a moment.";
  else if (shown) status = count === 0 ? `Nothing found for “${q}”.` : count === 1 ? "1 result." : `${count} results.`;
  else if (q.length < MIN_QUERY) status = notice;

  let index = 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="min-h-11 min-w-11 flex items-center justify-center gap-1.5 rounded-control px-2 text-sm text-bar-ink hover:text-bar-active hover:bg-bar-ink/5 transition-colors"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 L21 21" />
        </svg>
        <span className="sr-only lg:not-sr-only">Search</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={ids.title}
        // The help is read once, when the window opens. On the field it was read again after every letter typed (NVDA).
        aria-describedby={ids.hint}
        onClose={close}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="open:flex open:flex-col overflow-hidden text-ink bg-surface border border-line-strong rounded-card p-0 backdrop:bg-black/50 mx-auto mt-[min(10vh,5rem)] mb-auto w-[min(38rem,calc(100vw-2rem))] max-h-[calc(100dvh-2*min(10vh,5rem))] max-sm:m-0 max-sm:w-full max-sm:max-w-none max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none max-sm:border-0"
      >
        {open && (
          <div className="flex-1 min-h-0 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center gap-2 px-4 pt-3">
              <h2 id={ids.title} className="flex-1 text-base font-semibold text-ink-strong">
                <label htmlFor={ids.input}>Search</label>
              </h2>
              <Button variant="quiet" onClick={close} aria-label="Close search" className="min-w-11 min-h-11 sm:min-h-11 flex items-center justify-center">
                <span aria-hidden="true" className="text-lg leading-none">✕</span>
              </Button>
            </div>

            <div className="px-4 pb-2">
              <input
                ref={input}
                id={ids.input}
                type="text"
                role="combobox"
                inputMode="search"
                enterKeyHint="go"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-autocomplete="list"
                aria-controls={ids.list}
                aria-expanded={items.length > 0}
                aria-activedescendant={items.length > 0 ? ids.option(Math.min(active, items.length - 1)) : undefined}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onInputKey}
                className={`${fieldFullClass} min-h-11 text-base`}
              />
              <div className="mt-1.5 min-h-5 text-xs text-ink-faint">
                <p role="status" className={status ? "" : "sr-only"}>{status}</p>
                {!status && pending === q && <p aria-hidden="true">Searching…</p>}
                {q.length < MIN_QUERY && (
                  <p>
                    Type at least {MIN_QUERY} letters to find a page, a tarot card, a rune, an ogham stave, an archetype, a concept,
                    a post in the forum, or your own readings, journals, meanings, predictions and days. A date such as
                    “yesterday” or “3 October” opens that day.
                  </p>
                )}
              </div>
              <details className="mt-1 text-sm">
                <summary className="min-h-11 flex items-center cursor-pointer text-ink-soft hover:text-ink">
                  Also look in{also.length > 0 ? ` (${also.filter((id) => places.some((o) => o.id === id)).length} on)` : ""}
                </summary>
                <div className="pb-1">
                  {places.map((o) => (
                    <label key={o.id} className="flex items-start gap-2 min-h-11 py-1.5 text-ink">
                      <input
                        type="checkbox"
                        checked={also.includes(o.id)}
                        onChange={(e) => toggleAlso(o.id, e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        {o.label}
                        <span className="block text-xs text-ink-faint">{o.hint} Off unless you tick it; remembered on this device.</span>
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            </div>

            <div
              id={ids.list}
              // A listbox with no options is not one; the box stays so the field's aria-controls always points at it.
              role={items.length > 0 ? "listbox" : undefined}
              aria-label={items.length > 0 ? "Results" : undefined}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 border-t border-line-faint"
            >
              {q.length < MIN_QUERY && recent && (
                <section aria-labelledby={ids.recent} className="pt-3">
                  <h3 id={ids.recent} className="px-2 pb-1 text-xs text-ink-faint uppercase tracking-widest font-normal">
                    Recent searches
                  </h3>
                  {recent.on ? (
                    <>
                      {recent.items.length > 0 ? (
                        <ul>
                          {recent.items.map((r) => (
                            <li key={r.id} className="flex items-center">
                              <button
                                type="button"
                                onClick={() => reuse(r.query)}
                                className="flex-1 min-w-0 min-h-11 px-2 text-left text-sm text-ink hover:bg-surface-sunken rounded-control break-words"
                              >
                                {r.query}
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove “${r.query}” from recent searches`}
                                onClick={() => changeRecent(`Removed “${r.query}”.`, "DELETE", `?id=${r.id}`)}
                                className="min-w-11 min-h-11 flex items-center justify-center text-ink-faint hover:text-ink-soft rounded-control"
                              >
                                <span aria-hidden="true">✕</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-2 pb-1 text-sm text-ink-muted">
                          Nothing saved yet. A search is saved when you open one of its results.
                        </p>
                      )}
                      <div className="px-1 pt-1 flex flex-wrap gap-x-2">
                        {recent.items.length > 0 && (
                          <Button variant="quiet" onClick={() => changeRecent("Recent searches cleared.", "DELETE")}>
                            Clear recent searches
                          </Button>
                        )}
                        <Button
                          variant="quiet"
                          onClick={() => changeRecent("Recent searches are off, and the saved ones are deleted.", "PUT", "", { on: false })}
                        >
                          Turn off recent searches
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="px-2 pb-1 text-sm text-ink-muted">
                        Off. If you turn it on, the words you search for are saved in your account, the latest 20, so you can search
                        them again. They are shown only to you. You can clear them or turn this off at any time.
                      </p>
                      <div className="px-1">
                        <Button variant="quiet" onClick={() => changeRecent("Recent searches are on.", "PUT", "", { on: true })}>
                          Remember my recent searches
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              )}
              {shown?.groups.map((g) => (
                <div
                  key={g.id}
                  role="group"
                  aria-label={g.more ? `${g.label}, the first ${g.items.length}; more match` : g.label}
                  className="pt-3"
                >
                  <div aria-hidden="true" className="px-2 pb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-ink-faint uppercase tracking-widest">
                    <span>{g.label}</span>
                    {g.more && <span className="normal-case tracking-normal text-ink-ghost">more match: type more to narrow</span>}
                  </div>
                  {g.items.map((item) => {
                    const i = index++;
                    const chosen = i === Math.min(active, items.length - 1);
                    const date = item.day ? longDay(item.day) : item.when ? shortDate(item.when) : null;
                    return (
                      <Link
                        key={item.id}
                        id={ids.option(i)}
                        href={item.href}
                        role="option"
                        aria-selected={chosen}
                        tabIndex={-1}
                        onClick={(e) => {
                          // Ctrl, Cmd or Shift opens a new tab or window: this window stays for the next result.
                          keepWords();
                          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) close();
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="block min-h-11 px-2 py-2 rounded-control text-sm text-ink hover:bg-surface-sunken aria-selected:bg-surface-sunken aria-selected:outline-2 aria-selected:outline-focus aria-selected:-outline-offset-2 break-words"
                      >
                        <span className="text-ink-strong">{item.day ? date : item.label}</span>
                        {(item.note || (date && !item.day)) && (
                          <span className="text-xs text-ink-faint">
                            <span className="sr-only">, </span>
                            <span aria-hidden="true"> · </span>
                            {[item.note, item.day ? null : date].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {item.snippet && (
                          <span className="block text-xs text-ink-muted mt-0.5">
                            <span className="sr-only">, </span>
                            {item.snippet[0]}
                            <mark className="bg-transparent text-ink-strong font-semibold underline underline-offset-2">{item.snippet[1]}</mark>
                            {item.snippet[2]}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            <p id={ids.hint} className="max-sm:hidden px-4 py-2 border-t border-line-faint text-xs text-ink-faint">
              Up and Down arrows choose a result, Enter opens it, Esc closes. Ctrl+K (⌘K on a Mac) opens search on any page.
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
