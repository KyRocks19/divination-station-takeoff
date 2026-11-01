import Link from "next/link";
import { HELP_PATH } from "@/lib/crisis-lines";

/** The quiet line at the foot of every page, signed in or not: where to find help, and the privacy text. */
export default function SiteFooter() {
  return (
    <footer className="px-4 py-4 text-center text-xs text-ink-faint print:hidden">
      <Link href={HELP_PATH} className="inline-flex items-center min-h-6 underline hover:text-accent-ink">
        If you are struggling
      </Link>
      {" · "}
      <Link href="/privacy" className="inline-flex items-center min-h-6 underline hover:text-accent-ink">
        Privacy and terms
      </Link>
    </footer>
  );
}
