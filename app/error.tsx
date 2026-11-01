"use client";

import Link from "next/link";
import { Page, PageTitle } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";

// Shown when a page fails while it is being made (the database did not answer, a bug). Inside the root layout. In a release
// build a server error reaches the browser only as a generic message and a reference (digest), never its details, so the
// reference is shown for matching the server's log and nothing else is.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <Page>
      <title>Something went wrong</title>
      <PageTitle>This page could not be shown</PageTitle>
      <p role="alert" className="text-sm text-ink-muted leading-relaxed">
        Something went wrong while the page was being made. What you saved before is kept. Try again, or go back to the home
        page.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className="text-sm text-accent-ink hover:text-accent-ink-hover underline">Home</Link>
      </div>
      {digest && <p className="text-xs text-ink-faint">Reference for the person who runs this copy: {digest}</p>}
    </Page>
  );
}
