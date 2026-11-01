"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { noticeText, noticesFrom, type LetterNotice } from "@/lib/letters-core";
import { SectionLabel } from "@/components/ui/Page";

/**
 * Letters waiting at the top of today's page: a question asked of the person, a letter that arrived, a write-back day they chose, or a
 * reply to a letter they sent. Each clears itself when the person acts on it on the Letters page. Nothing is drawn when nothing is waiting,
 * or on a copy without letters.
 */
export default function LetterNotices() {
  const [notices, setNotices] = useState<LetterNotice[]>([]);

  useEffect(() => {
    let live = true;
    fetch("/api/letters")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.letters) setNotices(noticesFrom(d.letters, new Date().toLocaleDateString("en-CA"))); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (notices.length === 0) return null;
  return (
    <section aria-labelledby="letter-notices" className="space-y-2 print:hidden">
      <SectionLabel id="letter-notices">Letters</SectionLabel>
      <ul className="list-disc pl-5 text-sm text-ink-soft space-y-1">
        {notices.map((n) => <li key={`${n.kind}-${n.id}`}>{noticeText(n)}</li>)}
      </ul>
      <Link href="/letters" className="text-sm text-accent-ink hover:text-accent-ink-hover underline">Go to your letters</Link>
    </section>
  );
}
