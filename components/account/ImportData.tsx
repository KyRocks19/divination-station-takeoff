"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ImportReport } from "@/lib/import-core";

type Step = { name: "choose" } | { name: "checked"; data: unknown; report: ImportReport; file: string } | { name: "done"; report: ImportReport };

/**
 * Settings: bring a copy of your writing in from an export file (the .json from "Complete data"). It checks first and says what it would add, then
 * adds only what is new: nothing you already have is changed or deleted. The file is read here in the browser and sent to this app's own server.
 */
export default function ImportData() {
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(data: unknown, apply: boolean): Promise<ImportReport> {
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, apply }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "That could not be done. Nothing was changed.");
    return body as ImportReport;
  }

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (file.size > 14_000_000) throw new Error("That file is too large to bring in at once.");
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("That is not a Divination Station export. Use the .json file from \"Complete data\" above.");
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
  const total = report?.sections.reduce((s, x) => s + x.add, 0) ?? 0;

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <h3 id={`${uid}-h`} className="font-semibold text-ink-strong">Bring in your records</h3>
          <p className="text-xs text-ink-faint mt-0.5">
            Add the writing from an export file (the .json from &ldquo;Complete data&rdquo;, made on this app or another copy of it) to this account. You see what would be added
            first. Nothing you already have is changed or deleted: a reading, meaning or note that is already here is left as it is.
          </p>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={choose} className="sr-only" tabIndex={-1} aria-hidden="true" />
        {step.name !== "done" && (
          <Button variant="quiet" disabled={busy} onClick={() => fileInput.current?.click()} aria-describedby={`${uid}-h`}>
            {busy ? "Working…" : step.name === "checked" ? "Choose a different file" : "Choose an export file"}
          </Button>
        )}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        {report && (
          <section aria-label={step.name === "done" ? "What was added" : "What would be added"} className="space-y-2">
            <p role="status" className="text-sm text-ink-soft">
              {step.name === "checked"
                ? total > 0 ? `${step.file}: ${total} new row${total === 1 ? "" : "s"} would be added.` : `${step.file}: nothing new to add.`
                : total > 0 ? `Done. ${total} new row${total === 1 ? "" : "s"} added.` : "Done. There was nothing new to add."}
            </p>
            <table className="w-full text-sm">
              <caption className="sr-only">{step.name === "done" ? "Rows added, already here, and left out" : "Rows that would be added, already here, and left out"}</caption>
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th scope="col" className="py-1 pr-2 font-normal">Part</th>
                  <th scope="col" className="py-1 px-2 text-right font-normal">{step.name === "done" ? "Added" : "To add"}</th>
                  <th scope="col" className="py-1 px-2 text-right font-normal">Already here</th>
                  <th scope="col" className="py-1 pl-2 text-right font-normal">Left out</th>
                </tr>
              </thead>
              <tbody>
                {report.sections.map((s) => (
                  <tr key={s.id} className="border-t border-line align-top">
                    <th scope="row" className="py-1.5 pr-2 text-left font-normal text-ink-soft break-words">
                      {s.label}
                      {s.note && <span className="block text-xs text-ink-faint">{s.note}</span>}
                    </th>
                    <td className="py-1.5 px-2 text-right text-ink-strong">{s.add}</td>
                    <td className="py-1.5 px-2 text-right text-ink-soft">{s.have}</td>
                    <td className="py-1.5 pl-2 text-right text-ink-soft">{s.left_out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.not_imported.length > 0 && (
              <details className="text-xs text-ink-faint">
                <summary className="cursor-pointer">Parts of the file this version does not bring in</summary>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {report.not_imported.map((n) => (
                    <li key={n.key} className="break-words"><span className="text-ink-soft">{n.key}</span>: {n.why}</li>
                  ))}
                </ul>
              </details>
            )}
            {step.name === "checked" && total > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={apply}>{busy ? "Adding…" : `Add these ${total} rows to my account`}</Button>
                <Button variant="quiet" disabled={busy} onClick={() => { setStep({ name: "choose" }); setError(null); }}>Cancel</Button>
              </div>
            )}
            {step.name === "done" && (
              <Button variant="quiet" onClick={() => { setStep({ name: "choose" }); setError(null); }}>Bring in another file</Button>
            )}
          </section>
        )}
      </div>
    </Card>
  );
}
