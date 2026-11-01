"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Page";
import ClothPicture from "@/components/cloth/ClothPicture";
import { EXAMPLE_CLOTHS, exampleToCloth, type ExampleCloth } from "@/lib/cloth-examples";

/**
 * A few cloths other people have described, behind a button. Nothing is added until the person presses "Make my own copy"; the copy is an ordinary cloth
 * they can change, and its description says it began as an example and where it comes from, so a source's words are not mistaken for their own.
 */
export default function ExampleCloths() {
  const uid = useId();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copy(ex: ExampleCloth) {
    setBusy(ex.id);
    setError(null);
    try {
      const res = await fetch("/api/cloths", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exampleToCloth(ex)) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "Could not make the copy.");
      router.push(`/lots/cloths/${body.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the copy. Nothing was added; try again.");
      setBusy(null);
    }
  }

  return (
    <details className="bg-surface border border-line rounded-card p-4 group">
      <summary className="cursor-pointer text-sm text-ink-strong min-h-6">Start from an example cloth instead</summary>
      <div className="mt-3 space-y-4">
        <p className="text-xs text-ink-faint leading-relaxed">
          These are cloths other people have described. Each one says where it comes from and how well it is known. Nothing is added to your cloths unless you press &ldquo;Make my own
          copy&rdquo;, and a copy is yours to change. The app does not say any of these is right for you.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <ul className="list-none p-0 space-y-4">
          {EXAMPLE_CLOTHS.map((ex) => (
            <li key={ex.id} className="border-t border-line pt-4 space-y-2">
              <h2 id={`${uid}-${ex.id}`} className="text-sm text-ink-strong font-medium">{ex.name}</h2>
              <p className="text-sm text-ink-muted">{ex.summary}</p>
              <ClothPicture
                zones={ex.zones}
                label={ex.zones.length ? `${ex.name}: a square cloth with ${ex.zones.length} zones: ${ex.zones.map((z) => z.name).join(", ")}.` : `${ex.name}: an empty square cloth.`}
                className="w-40 max-w-full"
              />
              {ex.zones.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-ink-soft space-y-0.5">
                  {ex.zones.map((z) => <li key={z.name}>{z.name}: {z.note}</li>)}
                </ul>
              )}
              <p className="text-xs text-ink-faint">
                <span className="text-ink-soft">Where it comes from:</span>{" "}
                <a href={ex.source.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:text-accent-ink-hover underline">{ex.source.cite}<span className="sr-only"> (opens in a new tab)</span></a>.{" "}
                {ex.source.checked}
              </p>
              <p className="text-xs text-ink-faint"><span className="text-ink-soft">How well it is known:</span> {ex.settled}</p>
              {ex.assumed && <p className="text-xs text-ink-faint"><span className="text-ink-soft">What this copy had to decide:</span> {ex.assumed}</p>}
              <Button variant="quiet" disabled={busy !== null} onClick={() => copy(ex)} aria-describedby={`${uid}-${ex.id}`}>
                {busy === ex.id ? "Making the copy…" : "Make my own copy"}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
