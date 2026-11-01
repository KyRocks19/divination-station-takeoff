"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseDate } from "@/lib/date";
import type { LetterView } from "@/lib/letters-core";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/Page";

/**
 * On a reading's page: the letters the person sent from this reading to someone in their circle, with what that person wrote back. Their
 * reply is their own words about how it went, beside the reader's own look-backs. Draws nothing when there are none, or on a copy without
 * letters (the request answers "not found").
 */
export default function ReadingLetters({ divinationId, readingId }: { divinationId?: number; readingId?: number }) {
  const [letters, setLetters] = useState<LetterView[]>([]);

  useEffect(() => {
    let live = true;
    const q = divinationId ? `divination_id=${divinationId}` : readingId ? `reading_id=${readingId}` : null;
    if (!q) return;
    fetch(`/api/letters?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setLetters(d?.letters ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, [divinationId, readingId]);

  if (letters.length === 0) return null;
  return (
    <section aria-labelledby="reading-letters" className="space-y-2">
      <SectionLabel id="reading-letters">Letters from this reading</SectionLabel>
      <ul className="space-y-3 list-none p-0">
        {letters.map((l) => (
          <li key={l.id}>
            <Card pad="sm" className="space-y-2">
              <p className="text-xs text-ink-faint">To {l.asker_name}{l.sealed_at ? ` · sealed ${parseDate(l.sealed_at).toLocaleDateString()}` : ""}</p>
              {l.question && <p className="text-sm text-ink-muted whitespace-pre-wrap break-words">{l.question}</p>}
              {l.reply ? (
                <div className="space-y-1">
                  <p className="text-xs text-ink-faint">{l.asker_name} wrote back{l.replied_at ? ` on ${parseDate(l.replied_at).toLocaleDateString()}` : ""}</p>
                  <p className="text-sm text-ink-strong whitespace-pre-wrap break-words">{l.reply}</p>
                </div>
              ) : (
                <p className="text-xs text-ink-ghost">No reply yet.</p>
              )}
              <Link href="/letters" className="text-xs text-accent-ink hover:text-accent-ink-hover underline">All letters</Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
