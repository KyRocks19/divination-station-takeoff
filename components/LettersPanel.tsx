"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { parseDate } from "@/lib/date";
import { MAX_LETTER_LENGTH, MAX_QUESTION_LENGTH, MAX_REPLY_LENGTH, noticeText, noticesFrom, type LetterView } from "@/lib/letters-core";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote, SectionLabel } from "@/components/ui/Page";

interface Data {
  letters: LetterView[];
  members: { id: number; name: string }[];
  readings: { id: number; line: string; created_at: string }[];
}

const today = () => new Date().toLocaleDateString("en-CA");
const when = (iso: string) => parseDate(iso).toLocaleDateString();

function send(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Runs one request and reloads the list; shows the server's words when it refuses. */
function useAct(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = useCallback(
    async (request: () => Promise<Response>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await request();
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          setError(d?.error && d.error !== "Not found" ? d.error : "That did not work. The letter may have changed; the list has been refreshed.");
          await reload();
          return false;
        }
        await reload();
        return true;
      } catch {
        setError("That could not be sent. Try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );
  return { busy, error, act };
}

/** The question, or a plain line saying it is hidden until the reader seals their letter. */
function Question({ l }: { l: LetterView }) {
  if (l.question === null) return <p className="text-sm text-ink-muted italic">A blind letter: you see the question after you seal your letter.</p>;
  return <p className="text-sm text-ink-strong whitespace-pre-wrap break-words">{l.question}</p>;
}

function Written({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="text-sm text-ink-strong whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

function DeleteButton({ l, onDone, label, confirmText }: { l: LetterView; onDone: () => Promise<void>; label: string; confirmText: string }) {
  const [confirm, setConfirm] = useState(false);
  const { busy, error, act } = useAct(onDone);
  if (!confirm) return <Button variant="danger" className="min-h-6" onClick={() => setConfirm(true)}>{label}</Button>;
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-muted">{confirmText}</p>
      <div className="flex gap-3 items-center">
        <Button variant="danger" className="min-h-6" disabled={busy} onClick={() => act(() => send(`/api/letters/${l.id}`, "DELETE"))}>Yes, {label.toLowerCase()}</Button>
        <Button variant="quiet" onClick={() => setConfirm(false)}>Keep it</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

function AskForm({ members, onDone }: { members: Data["members"]; onDone: () => Promise<void> }) {
  const qId = useId();
  const toId = useId();
  const blindId = useId();
  const [question, setQuestion] = useState("");
  const [to, setTo] = useState("circle");
  const [blind, setBlind] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, act } = useAct(onDone);

  async function ask() {
    const ok = await act(() => send("/api/letters", "POST", { question, to: to === "circle" ? "circle" : Number(to), blind }));
    if (ok) {
      setQuestion("");
      setBlind(false);
      setSent(true);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <label htmlFor={qId} className="block text-xs text-ink-faint mb-1">Your question</label>
        <Textarea id={qId} rows={3} maxLength={MAX_QUESTION_LENGTH} value={question} onChange={(e) => { setQuestion(e.target.value); setSent(false); }} />
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="min-w-48">
          <label htmlFor={toId} className="block text-xs text-ink-faint mb-1">Ask</label>
          <Select id={toId} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="circle">Anyone in your circle</option>
            {members.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.name}</option>
            ))}
          </Select>
        </div>
        <label htmlFor={blindId} className="flex items-center gap-2 text-sm text-ink-soft min-h-11 sm:min-h-0">
          <input id={blindId} type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="accent-tone-500" />
          Blind letter
        </label>
      </div>
      <p className="text-xs text-ink-faint">
        In a blind letter, the reader does not see your question until they have sealed their letter, so they read from what comes up alone.
      </p>
      <div className="flex gap-3 items-center">
        <Button disabled={busy || !question.trim()} onClick={() => void ask()}>Send the question</Button>
        {sent && <p role="status" className="text-sm text-ink-muted">Sent. It is under Your questions below.</p>}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}

/** A letter waiting for this person to pick up. */
function Offered({ l, onDone }: { l: LetterView; onDone: () => Promise<void> }) {
  const { busy, error, act } = useAct(onDone);
  return (
    <li>
      <Card pad="sm" className="space-y-2">
        <p className="text-xs text-ink-faint">
          {l.asker_name} asked {l.to_circle ? "the circle" : "you"} · {when(l.created_at)}
        </p>
        <Question l={l} />
        <div className="flex flex-wrap gap-3 items-center">
          <Button disabled={busy} onClick={() => act(() => send(`/api/letters/${l.id}`, "PATCH", { action: "take" }))}>Read for this</Button>
          {!l.to_circle && (
            <Button variant="quiet" disabled={busy} onClick={() => act(() => send(`/api/letters/${l.id}`, "PATCH", { action: "decline" }))}>
              I would rather not
            </Button>
          )}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </Card>
    </li>
  );
}

/** A letter this person picked up and has not sealed: choose a reading (or none), write, look at what will be sent, seal. */
function Reading({ l, readings, onDone }: { l: LetterView; readings: Data["readings"]; onDone: () => Promise<void> }) {
  const readingId = useId();
  const letterId = useId();
  const [reading, setReading] = useState("");
  const [letter, setLetter] = useState("");
  const [preview, setPreview] = useState(false);
  const { busy, error, act } = useAct(onDone);
  const line = readings.find((r) => String(r.id) === reading)?.line ?? null;

  return (
    <li>
      <Card pad="sm" className="space-y-3">
        <p className="text-xs text-ink-faint">
          For {l.asker_name} · asked {when(l.created_at)}
        </p>
        <Question l={l} />
        <p className="text-xs text-ink-faint">
          Do a reading with any tool, the way you usually would. Then come back here, choose it, and write your letter in your own words.
        </p>
        <div>
          <label htmlFor={readingId} className="block text-xs text-ink-faint mb-1">Your reading (from the last two weeks)</label>
          <Select id={readingId} value={reading} onChange={(e) => { setReading(e.target.value); setPreview(false); }}>
            <option value="">None: a letter with no reading named</option>
            {readings.map((r) => (
              <option key={r.id} value={String(r.id)}>{when(r.created_at)}: {r.line}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={letterId} className="block text-xs text-ink-faint mb-1">Your letter</label>
          <Textarea id={letterId} rows={6} maxLength={MAX_LETTER_LENGTH} value={letter} onChange={(e) => { setLetter(e.target.value); setPreview(false); }} />
        </div>
        {preview && (
          <div className="border-l-2 border-line pl-3 space-y-2" aria-label="What will be sent">
            <p className="text-xs text-ink-faint">This is everything {l.asker_name} will see from you. Once sealed it cannot be changed.</p>
            {line && <Written label="Your reading" text={line} />}
            <Written label="Your letter" text={letter.trim()} />
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-center">
          {!preview ? (
            <Button disabled={!letter.trim()} onClick={() => setPreview(true)}>Look it over</Button>
          ) : (
            <Button
              disabled={busy || !letter.trim()}
              onClick={() => act(() => send(`/api/letters/${l.id}`, "PATCH", { action: "seal", letter, divination_id: reading ? Number(reading) : null }))}
            >
              Seal and send
            </Button>
          )}
          <Button variant="quiet" disabled={busy} onClick={() => act(() => send(`/api/letters/${l.id}`, "PATCH", { action: "put_back" }))}>
            Put it back
          </Button>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </Card>
    </li>
  );
}

/** A question this person asked, at whatever stage it is. */
function Asked({ l, onDone }: { l: LetterView; onDone: () => Promise<void> }) {
  const dateId = useId();
  const replyId = useId();
  const [day, setDay] = useState(l.write_back_on ?? "");
  const [reply, setReply] = useState(l.reply ?? "");
  const [editing, setEditing] = useState(!l.reply);
  const { busy, error, act } = useAct(onDone);
  const patch = (body: Record<string, unknown>) => act(() => send(`/api/letters/${l.id}`, "PATCH", body));
  const who = l.to_circle ? "your circle" : (l.to_name ?? "someone who has left the circle");

  return (
    <li>
      <Card pad="sm" className="space-y-3">
        <p className="text-xs text-ink-faint">
          You asked {who}{l.blind ? " (blind letter)" : ""} · {when(l.created_at)}
        </p>
        <p className="text-sm text-ink-strong whitespace-pre-wrap break-words">{l.question}</p>

        {l.stage === "waiting" && (
          <p className="text-sm text-ink-muted">{l.to_circle || l.to_name ? "Waiting for someone to pick it up." : "The person you asked is no longer in your circle."}</p>
        )}
        {l.stage === "declined" && <p className="text-sm text-ink-muted">{l.to_name ?? "They"} would rather not read for this one.</p>}
        {(l.stage === "declined" || (l.stage === "waiting" && !l.to_circle)) && (
          <Button variant="text" className="min-h-6" disabled={busy} onClick={() => patch({ action: "ask_circle" })}>Ask the whole circle instead</Button>
        )}
        {l.stage === "reading" && <p className="text-sm text-ink-muted">{l.reader_name} is reading for this.</p>}
        {l.stage === "sealed" && (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">A letter from {l.reader_name} has arrived. Open it when you are ready.</p>
            <Button disabled={busy} onClick={() => patch({ action: "open" })}>Open the letter</Button>
          </div>
        )}

        {(l.stage === "opened" || l.stage === "replied") && (
          <div className="space-y-3">
            <p className="text-xs text-ink-faint">From {l.reader_name}{l.sealed_at ? ` · sealed ${when(l.sealed_at)}` : ""}</p>
            {l.reading_line && <Written label="Their reading" text={l.reading_line} />}
            {l.letter && <Written label="Their letter" text={l.letter} />}

            {editing ? (
              <div className="space-y-2">
                <label htmlFor={replyId} className="block text-xs text-ink-faint">Write back: how did it go? (whenever you are ready)</label>
                <Textarea id={replyId} rows={4} maxLength={MAX_REPLY_LENGTH} value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="flex gap-3 items-center">
                  <Button
                    disabled={busy || !reply.trim()}
                    onClick={async () => { if (await patch({ action: "reply", text: reply })) setEditing(false); }}
                  >
                    Send to {l.reader_name}
                  </Button>
                  {l.reply && <Button variant="quiet" onClick={() => { setReply(l.reply ?? ""); setEditing(false); }}>Cancel</Button>}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {l.reply && <Written label={`You wrote back${l.replied_at ? ` on ${when(l.replied_at)}` : ""}`} text={l.reply} />}
                <Button variant="text" className="min-h-6" onClick={() => setEditing(true)}>Change what you wrote</Button>
              </div>
            )}

            {l.stage === "opened" && (
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label htmlFor={dateId} className="block text-xs text-ink-faint mb-1">Remind me to write back on (optional)</label>
                  <Input id={dateId} type="date" wide={false} value={day} onChange={(e) => setDay(e.target.value)} />
                </div>
                <Button variant="quiet" disabled={busy || day === (l.write_back_on ?? "")} onClick={() => patch({ action: "write_back_on", day: day || null })}>
                  {day ? "Save the day" : "No reminder"}
                </Button>
              </div>
            )}
          </div>
        )}

        <DeleteButton
          l={l}
          onDone={onDone}
          label="Delete"
          confirmText={
            l.sealed_at
              ? `This deletes your question, ${l.reader_name}'s letter and anything you wrote back, for both of you.`
              : "This deletes your question."
          }
        />
        {error && <ErrorNote>{error}</ErrorNote>}
      </Card>
    </li>
  );
}

/** A letter this person sealed and sent, and the reply if one came back. */
function Sent({ l, onDone }: { l: LetterView; onDone: () => Promise<void> }) {
  return (
    <li>
      <Card pad="sm" className="space-y-3">
        <p className="text-xs text-ink-faint">
          To {l.asker_name}{l.blind ? " (blind letter)" : ""}{l.sealed_at ? ` · sealed ${when(l.sealed_at)}` : ""}
          {l.stage === "sealed" ? " · not opened yet" : ""}
        </p>
        <Written label="Their question" text={l.question ?? ""} />
        {l.reading_line && <Written label="Your reading" text={l.reading_line} />}
        {l.reading_href && (
          <Link href={l.reading_href} className="text-xs text-accent-ink hover:text-accent-ink-hover underline">Open your reading</Link>
        )}
        {l.letter && <Written label="Your letter" text={l.letter} />}
        {l.reply && <Written label={`${l.asker_name} wrote back${l.replied_at ? ` on ${when(l.replied_at)}` : ""}${l.reply_new ? " (new)" : ""}`} text={l.reply} />}
        <DeleteButton l={l} onDone={onDone} label="Remove from my list" confirmText={`${l.asker_name} keeps the letter you sent.`} />
      </Card>
    </li>
  );
}

/**
 * The Letters page: ask your circle a question, read for theirs, and the letters that came back. Nothing here is scored or compared; the
 * replies are the asker's own words about how things went.
 */
export default function LettersPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/letters");
      if (!res.ok) throw new Error();
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // A reply shown on this page counts as seen; it stays marked "(new)" until the next visit.
  useEffect(() => {
    for (const l of data?.letters ?? []) {
      if (l.reply_new) void send(`/api/letters/${l.id}`, "PATCH", { action: "reply_seen" }).catch(() => {});
    }
  }, [data]);

  if (failed && !data) return <ErrorNote>The letters could not be loaded. Try again in a moment.</ErrorNote>;
  if (!data) return <p className="text-sm text-ink-ghost">Loading…</p>;

  const { letters, members, readings } = data;
  const offered = letters.filter((l) => l.role === "offered");
  const reading = letters.filter((l) => l.role === "reader" && l.stage === "reading");
  const asked = letters.filter((l) => l.role === "asker");
  const sent = letters.filter((l) => l.role === "reader" && l.stage !== "reading");
  const notices = noticesFrom(letters, today());
  const inCircle = members.length > 0;

  return (
    <div className="space-y-8">
      {notices.length > 0 && (
        <section aria-labelledby="letters-waiting" className="space-y-2">
          <SectionLabel id="letters-waiting">Waiting for you</SectionLabel>
          <ul className="list-disc pl-5 text-sm text-ink-soft space-y-1">
            {notices.map((n) => <li key={`${n.kind}-${n.id}`}>{noticeText(n)}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="letters-ask" className="space-y-2">
        <SectionLabel id="letters-ask">Ask for a reading</SectionLabel>
        {inCircle ? (
          <AskForm members={members} onDone={load} />
        ) : (
          <p className="text-sm text-ink-muted">
            Letters are between members of a circle. <Link href="/circle" className="underline text-accent-ink hover:text-accent-ink-hover">Join or make a circle</Link> to ask
            for a reading or read for someone.
          </p>
        )}
      </section>

      {offered.length > 0 && (
        <section aria-labelledby="letters-offered" className="space-y-2">
          <SectionLabel id="letters-offered">Questions you could read for</SectionLabel>
          <ul className="space-y-3 list-none p-0">{offered.map((l) => <Offered key={l.id} l={l} onDone={load} />)}</ul>
        </section>
      )}

      {reading.length > 0 && (
        <section aria-labelledby="letters-reading" className="space-y-2">
          <SectionLabel id="letters-reading">You are reading for</SectionLabel>
          <ul className="space-y-3 list-none p-0">{reading.map((l) => <Reading key={l.id} l={l} readings={readings} onDone={load} />)}</ul>
        </section>
      )}

      {asked.length > 0 && (
        <section aria-labelledby="letters-asked" className="space-y-2">
          <SectionLabel id="letters-asked">Your questions</SectionLabel>
          <ul className="space-y-3 list-none p-0">{asked.map((l) => <Asked key={l.id} l={l} onDone={load} />)}</ul>
        </section>
      )}

      {sent.length > 0 && (
        <section aria-labelledby="letters-sent" className="space-y-2">
          <SectionLabel id="letters-sent">Letters you sent</SectionLabel>
          <ul className="space-y-3 list-none p-0">{sent.map((l) => <Sent key={l.id} l={l} onDone={load} />)}</ul>
        </section>
      )}
    </div>
  );
}
