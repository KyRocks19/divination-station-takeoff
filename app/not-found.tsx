import Link from "next/link";
import { Page, PageTitle } from "@/components/ui/Page";

// Shown for an address the app does not have, and wherever a page calls notFound() (a reading that was deleted, an id that is
// not one of the person's own). Inside the root layout, so the menu and search are still there.
export default function NotFound() {
  return (
    <Page>
      <PageTitle>Page not found</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        There is nothing at this address. It may have been deleted, or the link may be mistyped. Nothing of yours has changed.
      </p>
      <p className="text-sm text-ink-muted">
        <Link href="/" className="text-accent-ink hover:text-accent-ink-hover underline">Home</Link>
        {" · "}
        <Link href="/readings" className="text-accent-ink hover:text-accent-ink-hover underline">Your readings</Link>
      </p>
    </Page>
  );
}

export const metadata = { title: "Page not found" };
