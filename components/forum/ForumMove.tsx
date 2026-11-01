"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BUNDLE_LIMITS } from "@/lib/forum-bundle-core";

interface Counts {
  posts_add: number;
  posts_have: number;
  comments_add: number;
  comments_have: number;
  matched_authors: number;
  unmatched_authors: number;
  left_out: number;
}
interface Report {
  applied: boolean;
  circle_name: string;
  from_circle: string;
  attachments_left_out: number;
  counts: Counts;
}
type Step = { name: "choose" } | { name: "checked"; data: unknown; report: Report; file: string } | { name: "done"; report: Report };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Forum page, administrators only: carry a circle's forum from one host's copy to another's. "Save" downloads a file; "Bring in" reads a file made
 * on another host, says what it would add, and then adds only what is new. Nothing here is changed or deleted. Rules: lib/forum-bundle-core.ts.
 */
export default function ForumMove() {
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(data: unknown, apply: boolean): Promise<Report> {
    const res = await fetch("/api/forum/bundle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, apply }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "That could not be done. Nothing was changed.");
    return body as Report;
  }

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (file.size > BUNDLE_LIMITS.bytes) throw new Error("That file is too large to bring in at once.");
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("That is not a forum file from Divination Station. Use a file made by \"Save the forum to a file\" on another host.");
      }
      setStep({ name: "checked", data, report: await send(data, false), file: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be read. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (step.name !== "checked") return;
    setBusy(true);
    setError(null);
    try {
      setStep({ name: "done", report: await send(step.data, true) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be done. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  const report = step.name === "choose" ? null : step.report;
  const c = report?.counts;
  const total = c ? c.posts_add + c.comments_add : 0;

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <h2 id={`${uid}-h`} className="font-semibold text-ink-strong">Move the forum to another host</h2>
          <p className="text-xs text-ink-faint mt-0.5">
            A host is the person whose computer runs a circle (<Link href="/guide/circles" className="text-accent-ink hover:text-accent-ink-hover underline">how circles and hosts work</Link>).
            Two hosts&apos; copies do not share anything by themselves, so a forum is moved with a file you carry across, by USB stick or in a message.
            Save this circle&apos;s forum to a file on one host, then bring the file in on the other. Bringing a file in only adds: a post or comment that is already
            there is left as it is, so the same file can be brought in twice, or passed back and forth, without making copies. Deleting a post on one host
            does not delete it on the other.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="quiet" href="/api/forum/bundle" prefetch={false} download>
            Save the forum to a file
          </ButtonLink>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={choose} className="sr-only" tabIndex={-1} aria-hidden="true" />
          {step.name !== "done" && (
            <Button variant="quiet" disabled={busy} onClick={() => fileInput.current?.click()} aria-describedby={`${uid}-h`}>
              {busy ? "Working…" : step.name === "checked" ? "Choose a different file" : "Bring in a forum file"}
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-faint">
          The file holds the posts and comments you can see here, with who wrote them and when. It has no passwords, codes or keys, and no attachments
          (an attachment points to a reading that stays with the person who wrote it), and no post or comment that was hidden after a report.
          Anyone who has the file can read the posts, so keep it as private as the forum.
        </p>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        {report && c && (
          <section aria-label={step.name === "done" ? "What was added" : "What would be added"} className="space-y-2">
            <p role="status" className="text-sm text-ink-soft">
              {step.name === "checked"
                ? total > 0
                  ? `${step.file} (from ${report.from_circle || "another host"}): ${plural(c.posts_add, "post")} and ${plural(c.comments_add, "comment")} would be added to ${report.circle_name}.`
                  : `${step.file}: nothing new to add.`
                : total > 0
                  ? `Done. ${plural(c.posts_add, "post")} and ${plural(c.comments_add, "comment")} added to ${report.circle_name}.`
                  : "Done. There was nothing new to add."}
            </p>
            <ul className="list-disc pl-5 text-xs text-ink-faint space-y-0.5">
              {c.posts_have + c.comments_have > 0 && (
                <li>{plural(c.posts_have, "post")} and {plural(c.comments_have, "comment")} in the file are already here and stay as they are.</li>
              )}
              {c.unmatched_authors > 0 && (
                <li>
                  {plural(c.unmatched_authors, "post or comment", "posts and comments")} {c.unmatched_authors === 1 ? "was" : "were"} written by someone with no account in this circle
                  {" "}(matching is by username). {c.unmatched_authors === 1 ? "It is" : "They are"} kept under your account and shown with the name {c.unmatched_authors === 1 ? "it was" : "they were"} written under and &ldquo;(from another host)&rdquo;.
                </li>
              )}
              {c.matched_authors > 0 && <li>{plural(c.matched_authors, "post or comment", "posts and comments")} will show the member here whose username matches the writer.</li>}
              {c.left_out > 0 && <li>{plural(c.left_out, "item")} in the file could not be read or belong to another circle in this copy, so {c.left_out === 1 ? "it was" : "they were"} left out.</li>}
              {report.attachments_left_out > 0 && <li>{plural(report.attachments_left_out, "post")} had attachments on the other host. Attachments are not carried.</li>}
            </ul>
            {step.name === "checked" && total > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={apply}>{busy ? "Adding…" : `Add ${plural(c.posts_add, "post")} and ${plural(c.comments_add, "comment")}`}</Button>
                <Button variant="quiet" disabled={busy} onClick={() => { setStep({ name: "choose" }); setError(null); }}>Cancel</Button>
              </div>
            )}
            {step.name === "done" && (
              <Button variant="quiet" onClick={() => { setStep({ name: "choose" }); setError(null); window.location.reload(); }}>Show the forum</Button>
            )}
          </section>
        )}
      </div>
    </Card>
  );
}
